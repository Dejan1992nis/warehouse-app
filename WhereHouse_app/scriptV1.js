// ========================================================== BACKEND ==========================================================


import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://ndnljnalwqpnsdnnjoql.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G7GepZscofTzQmzyoMmo0Q_0bD6zH0c';

//  PREIMENOVAN CLIENT
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);



async function fetchItems() {

    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from('items')
        .select('*')
        .eq('user_id', currentUser.id);

    if (error) {
        console.error(error);
        return;
    }

    items.length = 0;
    items.push(...data);

    updateDashboardCards();
    renderTable();
    renderLowStockTable();
}
//  uzima sve logove za jedan item
//  sortira ih (najnoviji prvi)
async function fetchLogs(itemId) {
    
    if (!currentUser) return [];

    const { data, error } = await supabaseClient
        .from('item_logs')
        .select('*')
        .eq('item_id', itemId)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });


    if (error) {
        console.error('LOG FETCH ERROR:', error);
        return [];
    }

    return data;
}
async function addLog(itemId, field, oldVal, newVal) {

    const { error } = await supabaseClient
        .from('item_logs')
        .insert([
            {
                item_id: itemId,
                field: field,
                old_value: String(oldVal),
                new_value: String(newVal),
                user_id: currentUser.id
            }
        ]);

    if (error) {
        console.error('LOG ERROR:', error);
    }
}

// ========================================================== GLOBAL VARIABLES ==========================================================
const items             = [];

let currentUser         = null;
let selectedItem        = null;
let originalQuantity    = null;

let currentPage         = 1;
const itemsPerPage      = 20;

// ========================================================== USER SETTING ==========================================================

async function saveUserSetting(key, value) {
    if (!currentUser) return;

    await supabaseClient
        .from('user_settings')
        .upsert({
            user_id: currentUser.id,
            key: key,
            value: value
        }, {
            onConflict: 'user_id,key'
        });
}

async function loadUserSetting(key) {
    if (!currentUser) return null;

    const { data, error } = await supabaseClient
        .from('user_settings')
        .select('value')
        .eq('key', key)
        .eq('user_id', currentUser.id) // Kvazno da se snima i po korsniku
        .maybeSingle();

    if (error) {
        console.error("loadUserSetting error:", error);
        return null;
    }

    return data ? data.value : null;
}


// ========================================================== AUTH ==========================================================
// -------------------- FEATURE: AUTH --------------------
//1.  SELECTORS ===
const appWrapper    = document.getElementById('app');
const authScreen    = document.getElementById('auth-screen');
const emailInput    = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const authMainBtn   = document.getElementById('auth-main-btn');
const switchMode    = document.getElementById('switch-mode');
const authTitle     = document.getElementById('auth-title');
const authSubtitle  = document.getElementById('auth-subtitle');
const switchLabel   = document.getElementById('auth-switch-label');
const authCard      = document.querySelector('.auth-card');

const logoutBtn     = document.getElementById('logout-btn');

//2.  STATE ===
let authLoading = false;
let isLoginMode = false;



//3.  FUNCTIONS ===
async function register(email, password) {

    if (authLoading) return;

    // 1. prazna polja
    if (!email || !password) {
        showNotification(t("auth_fill_fields"), 'error');
        return;
    }

    // 2. email format
    if (!isValidEmail(email)) {
        showNotification(t("auth_invalid_email"), 'error');
        return;
    }

    // 3. password length
    if (password.length < 6) {
        showNotification(t('auth_password_short'), 'error');
        return;
    }

    authLoading = true;

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

   

    if (error) {
        if (error.message.includes('User already registered')) {
            showNotification(t("auth_user_exists"), 'error');
        } else if (error.message.includes('rate limit')) {
            showNotification(t("auth_too_many"), 'error');
        } else {
            showNotification(error.message, 'error'); // može ostati raw
        }

        authLoading = false;
        return;
    }

    showNotification(t("auth_registered"), 'success');
    authLoading = false;
}
// LOGIN
async function login(email, password) {

    if (authLoading) return;

    //  1. prazna polja
    if (!email || !password) {
        showNotification(t('auth_login_fill'), 'error');
        return;
    }

    authLoading = true;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    // error iz Supabase
    if (error) {
        if (error.message.includes('Invalid login credentials')) {

            showNotification(t('auth_wrong_credentials'), 'error');
        } else {
            showNotification(error.message, 'error');
        }

        authLoading = false;
        return;
    }

    // KLJUČNO — dodatna provera
    if (!data || !data.user) {
        showNotification(t('auth_wrong_credentials'), 'error');
        authLoading = false;
        return;
    }

    showNotification(t('auth_logged_in'), 'success');

    currentUser = data?.user || null;

    await loadUserLanguage();
    await loadUserTrends();
    startApp();

    authLoading = false;
}
// LOGOUT
async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}
// PROVERA KORISNIKA
async function initUser() {
    const { data } = await supabaseClient.auth.getUser();
    currentUser = data?.user || null;

    if (currentUser) {
        startApp(); // odmah
    } else {
        showAuthScreen();
    }
}
// STARTOVANJE APP
async function startApp() {
    authScreen.style.display = 'none';
    appWrapper.classList.remove('hidden');

    showUserInfo();

    loadUserLanguage();
    loadUserTrends();

    await fetchItems();
}
function showUserInfo() {

    const el = document.querySelector('.user-email');
    if (!el || !currentUser) return;

    // uzmi deo pre @
    const email = currentUser.email;

    el.textContent = email;
}
// PRIKAZ AUTH EKRANA
function showAuthScreen() {
    authScreen.style.display = 'flex';
    appWrapper.classList.add('hidden');
}
function updateAuthUI() {

    if (isLoginMode) {

        authCard.classList.add('login-mode');

        //  menjamo KLJUČ
        authTitle.setAttribute('data-i18n', 'auth_login_title');
        authSubtitle.setAttribute('data-i18n', 'auth_login_subtitle');

        authMainBtn.setAttribute('data-i18n', 'auth_login');

        switchLabel.setAttribute('data-i18n', 'auth_no_account');
        switchMode.setAttribute('data-i18n', 'auth_register');

    } else {

        authCard.classList.remove('login-mode');

        authTitle.setAttribute('data-i18n', 'auth_title');
        authSubtitle.setAttribute('data-i18n', 'auth_subtitle');

        authMainBtn.setAttribute('data-i18n', 'auth_register');

        switchLabel.setAttribute('data-i18n', 'auth_have_account');
        switchMode.setAttribute('data-i18n', 'auth_login');
    }

    //  NAJBITNIJE — refresh prevoda
    applyTranslations();
}
// provera validnosti Mail-a
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}


//4.  EVENTS ===
authMainBtn.addEventListener('click', () => {

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (isLoginMode) {
        login(email, password);
    } else {
        register(email, password);
    }
});
// Promena LogIn <=>Registration
switchMode.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    updateAuthUI();
});
// Enter klik 
passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        authMainBtn.click();
    }
});
// LogOut  
logoutBtn.addEventListener('click', logout);



// ========================================================== INPUT ==========================================================

// -------------------- FEATURE: SEARCH  --------------------
//1.  SELECTORS ===
const input             = document.querySelector('#input-search');
const clearBtn          = document.querySelector('.clear-btn');
const resultsContainer  = document.querySelector('.results');

//3.  FUNCTIONS ===
function handleSearch() {

    const inputValue = input.value.trim().toLowerCase();

    if (inputValue === '') {
        clearResults();
        clearBtn.style.display = 'none';
        return;
    }

    clearBtn.style.display = 'block';

    const filtered = items.filter(item =>
        item.name.toLowerCase().includes(inputValue) ||
        String(item.code).includes(inputValue)
    );

    renderResults(filtered);
}

function renderResults(results) {

    clearResults();

    results.forEach(item => {
        const div = document.createElement('div');

        div.classList.add('result-item');
        div.textContent = `${item.name} (${item.code}) - ${item.status} `;

        div.addEventListener('click', function () {
            selectItem(item);
        });

        resultsContainer.appendChild(div);
    });
}

function clearResults() {
    resultsContainer.innerHTML = '';
}


//4.  EVENTS ===
// Search Input
input.addEventListener('input', handleSearch);
// Clear btn
clearBtn.addEventListener('click', function () {
    resetDisplay();
    clearResults();
});

// -------------------- FEATURE: SELECT ITEM --------------------

//1.  SELECTORS ===
const itemName          = document.getElementById('item-name');
const itemCode          = document.getElementById('item-code');
const itemStatus        = document.getElementById('item-status');
const itemLocation      = document.getElementById('item-location');
const itemPrice         = document.getElementById('item-price')
const ItemLimit         = document.getElementById('item-limit')
const quantityValue     = document.getElementById('quantity-value');

//3.  FUNCTIONS ===
function resetDisplay() {
    clearBtn.style.display = 'none';
    input.value = '';
    itemName.textContent = '-';
    itemCode.textContent = '-';
    itemStatus.textContent = '-';
    itemLocation.textContent = '-';
    itemPrice.textContent = '-';
    ItemLimit.textContent = '-';
    quantityValue.textContent = '0';
    selectedItem = null;

     // Sakri History dugme
    historyWrapper.classList.add('hidden');
}
function selectItem(item) {

    itemName.textContent        = item.name;
    itemCode.textContent        = item.code;
    itemStatus.textContent      = item.status;
    itemLocation.textContent    = item.location;
    itemPrice.textContent       = item.price;
    ItemLimit.textContent       = item.limit;
    quantityValue.textContent   = item.quantity;


    input.value = item.name;

    selectedItem = item;
    
    // Prikaži History dugme
    historyWrapper.classList.remove('hidden');

    originalQuantity = item.quantity;
    clearResults();
}

// -------------------- FEATURE: CHANGE QUANTITY -------------------
//1.  SELECTORS ===
const plusBtn           = document.querySelector('.btn-plus');
const minusBtn          = document.querySelector('.btn-minus');

//4.  EVENTS ===
plusBtn.addEventListener('click', function () {
    if (!selectedItem) return;
    
    selectedItem.quantity++;
    quantityValue.textContent = selectedItem.quantity;
});
minusBtn.addEventListener('click', function () {
    if (!selectedItem) return;

    if (selectedItem.quantity > 0) {
        selectedItem.quantity--;
    }

    quantityValue.textContent = selectedItem.quantity;
});


// -------------------- FEATURE: SAVE QUANTITY ------------------

//1.  SELECTORS ===
const saveBtn           = document.querySelector('.save-btn');

//3.  FUNCTIONS ===
// koristi fetchItems + addLog

//4.  EVENTS ===
saveBtn.addEventListener('click', async function () {

    // 1. VALIDACIJA
    if (!selectedItem) {
        showNotification(`❌ ${t('noItemSelected')}`, 'error');
        return;
    }

    // 2. STARE I NOVE VREDNOSTI
    const oldQuantity = originalQuantity;
    const newQuantity = selectedItem.quantity;

    // 3. LOGUJ SAMO AKO SE PROMENILA KOLIČINA
    if (oldQuantity !== newQuantity) {

        await addLog(
            selectedItem.id,
            'quantity',
            oldQuantity,
            newQuantity
        );
    }

    //  4. UPDATE U BAZI
    const { error } = await supabaseClient
        .from('items')
        .update({ quantity: newQuantity })
        .eq('id', Number(selectedItem.id));

    if (error) {
        console.error(error);
        showNotification(`❌ ${error.message}`, 'error');
        return;
    }

    // 5. SUCCESS + REFRESH
    showNotification(`✔ ${selectedItem.name} ${t('saved')}`, 'success');

    await fetchItems();

    // 6. RESET
    selectedItem = null;
    originalQuantity = null;

    resetDisplay();

    clearResults();
    

});


// -------------------- FEATURE: HISTORY LOG ------------------
//1.  SELECTORS ===
const historyModal      = document.querySelector('.history-modal');
const historyBtn        = document.querySelector('.btn-history');
const historyClose      = document.querySelector('.history-close');
const historyWrapper    = document.querySelector('.history-wrapper');
const ItemLog           = document.querySelector('.history-modal_itemLog')
//2.  STATE ===
//3.  FUNCTIONS ===
function renderLogs(logs) {

    const container = document.querySelector('.history-modal__body');
    //Naziv Item za koji geldamo LogHistory
    ItemLog.textContent = selectedItem ? selectedItem.name : 'No item';

    container.innerHTML = '';

    if (!logs || logs.length === 0) {
        container.textContent = `${t('noHistoryYet')}`;
        return;
    }

    logs.forEach(log => {

        const div = document.createElement('div');
        div.classList.add('history-item');

        let text = '';
        let date = new Date(log.created_at).toLocaleString('sr-RS');

        //  FORMATIRANJE PO TIPU
        if (log.field === 'quantity') {
            text = `${t('ItemQuantity')} ${log.old_value} → ${log.new_value}`;
                //da vrendosti budu brojevi a ne text
                const oldVal = parseFloat(log.old_value);
                const newVal = parseFloat(log.new_value);

                div.classList.add(newVal > oldVal ? 'plus' : 'minus');
        }

        else if (log.field === 'name') {
            text = `${t('itemName')} ${log.old_value} → ${log.new_value}`;
        }

        else if (log.field === 'location') {
            text = `${t('ItemLocation')}  ${log.old_value} → ${log.new_value}`;
        }

        else if (log.field === 'code') {
            text = `${t('ItemCode')} ${log.old_value} → ${log.new_value}`;
        }

        else if (log.field === 'status') {
            text = `${t('ItemStatus')} ${log.old_value} → ${log.new_value}`;
        }
        else if (log.field === 'price') {
            text = `${t('ItemPrice')} ${log.old_value} → ${log.new_value}`;
        }
        else if (log.field === 'limit') {
            text = `${t('Limit')} ${log.old_value} → ${log.new_value}`;
        }

        else if (log.field === 'created') {
            text = `${t('created')} ${log.new_value}`;
            div.classList.add('plus');
        }

        div.innerHTML = `
            <span>${text}</span>
            <span>${date}</span>
        `;

        container.appendChild(div);
    });
}

//4.  EVENTS ===
historyBtn.addEventListener('click', async function () {

    if (!selectedItem) {
        showNotification(`❌ ${t('noItemSelected')}`, 'error');
        return;
    }

    // UZMI LOGOVE
    const logs = await fetchLogs(selectedItem.id);

    // PRIKAŽI IH
    renderLogs(logs);

    // OTVORI MODAL
    historyModal.classList.remove('hidden');
});

historyClose.addEventListener('click', function () {
    historyModal.classList.add('hidden');
});

// -------------------- FEATURE: ADD / EDIT --------------------
//1.  SELECTORS ===
const modal             = document.querySelector('.modal');
const addOpenBtn        = document.querySelector('.btn-add');
const addSave           = document.querySelector('.btn-save');
const addCancel         = document.querySelector('.btn-cancel');

const editBtn           = document.querySelector('.btn-edit');
const modalTitle        = document.querySelector('.modal__title');

const newName           = document.getElementById('new-name');
const newCode           = document.getElementById('new-code');
const newStatus         = document.getElementById('new-status');
const newLocation       = document.getElementById('new-location');
const newPrice          = document.getElementById('new-price');
const newLimit          = document.getElementById('new-limit');

const newQuantity       = document.getElementById('new-quantity');

//2.  STATE ===
let editMode        = false;
let editItem        = null;

//3.  FUNCTIONS ===
function resetForm(){
    newName.value = '';
    newCode.value = '';
    newStatus.value = '';
    newLocation.value = '';
    newQuantity.value = '';
    newPrice.value = '';
    newLimit.value = '';
}

//4.  EVENTS ===
// Otvaranje Modula
addOpenBtn.addEventListener('click', function(){

    // OVO JE KLJUČ
    editMode = false;
    editItem = null;

    modalTitle.textContent = t('addModulTitle');

    modal.classList.remove('hidden');
    newName.focus();
})
//addCancel
addCancel.addEventListener('click', function(){
    modal.classList.add('hidden');
    
    editMode = false;
    editItem = null;

    newName.value = '';
    newCode.value = '';
    newStatus.value = '';
    newLocation.value = '';
    newPrice.value = '';
    newLimit.value = '';
    newQuantity.value = '';

    modalTitle.textContent = t('addModulTitle');
});
//SaveBtn
addSave.addEventListener('click', async function(){

    const name      = newName.value.trim();
    const code      = newCode.value.trim();
    const status    = newStatus.value.trim();
    const location  = newLocation.value.trim();
    
    const quantityRaw = newQuantity.value.trim();
    const quantity    = Number(quantityRaw);
    const priceRow    = newPrice.value.trim()
    const price       = Number(priceRow)
    const limitRow    = newLimit.value.trim();
    const limit       = Number(limitRow)


    //  VALIDACIJA
    if (!name || quantityRaw === '' || isNaN(quantity) || priceRow === '' || isNaN(price) || limitRow === '' || isNaN(limit)) {
        showNotification(`❌ ${t('errorFill')}`, 'error');
        return;
    }

    // ============================================================
    //  EDIT MODE
    // ============================================================
    if (editMode) {

        //  LOG CHANGES (pre update-a)
        if (editItem.name !== name) {
            await addLog(editItem.id, 'name', editItem.name, name);
        }

        if (editItem.code !== code) {
            await addLog(editItem.id, 'code', editItem.code, code);
        }

        if (editItem.location !== location) {
            await addLog(editItem.id, 'location', editItem.location, location);
        }
        if (editItem.status !== status) {
            await addLog(editItem.id, 'status', editItem.status, status);
        }

        if (editItem.quantity !== quantity) {
            await addLog(editItem.id, 'quantity', editItem.quantity, quantity);
        }
        if (editItem.price !== price) {
            await addLog(editItem.id, 'price', editItem.price, price);
        }
        if (editItem.limit !== limit) {
            await addLog(editItem.id, 'limit', editItem.limit, limit);
        }


        //  UPDATE ITEM
        const { error } = await supabaseClient
            .from('items')
            .update({
                name: name,
                code: code,
                status:status,
                location: location,
                quantity: quantity,
                price: price,
                limit: limit
            })
            .eq('id', Number(editItem.id));

        if (error) {
            console.error(error);
            showNotification(`❌ ${error.message}`, 'error');
            return;
        }


        //  SUCCESS
        showNotification(`✔ ${name} ${t('updated')}`, 'success');

        await fetchItems();

        //  vrati selektovan item
        const currentId = editItem.id;
        selectedItem = items.find(item => item.id === currentId);

        if (selectedItem) {
            selectItem(selectedItem);
        }

        modal.classList.add('hidden');
        resetForm();

        return;
    }
        // ======== ADD MODE ================
    else {

        //  INSERT ITEM + VRATI ID
        const { data, error } = await supabaseClient
            .from('items')
            .insert([
                {   name, 
                    code, 
                    status,
                    location, 
                    quantity, 
                    price, 
                    limit, 
                    user_id: currentUser.id }
            ])
            .select();

        if (error || !data || data.length === 0) {
            console.error(error);
            showNotification('❌ Error saving item', 'error');
            return;
        }

        const newId = data[0].id;

        //  LOG CREATE
        await addLog(newId, 'created', '', name);


        //  REFRESH UI
        await fetchItems();

        showNotification(`✔ ${name} ${t('added')}`, 'success');
    }


    // ============================================================
    // CLEANUP
    // ============================================================
    renderTable();
    modal.classList.add('hidden');

    resetForm();

    editMode = false;
    editItem = null;
});
//Klik izvan forme - zatvaranje forme
modal.addEventListener('click', function(e){
    if(e.target === modal){
        modal.classList.add('hidden');
    }
});
// EDIT btn
editBtn.addEventListener('click', function(){

    if(!selectedItem){
        showNotification(`❌ ${t('noItemSelected')}`, 'error');
        return;
    }

    // uključi edit mode
    editMode = true;
    editItem = selectedItem;

    // popuni formu
    newName.value       = selectedItem.name;
    newCode.value       = selectedItem.code;
    newStatus.value     = selectedItem.status;
    newLocation.value   = selectedItem.location;
    newQuantity.value   = selectedItem.quantity;
    newPrice.value      = selectedItem.price;
    newLimit.value      = selectedItem.limit;

    // promeni naslov modala
    modalTitle.textContent = t('editTitle');

    // otvori modal
    modal.classList.remove('hidden');
});

// -------------------- FEATURE: DELETE --------------------
//1.  SELECTORS ===
const deleteBtn         = document.querySelector('.btn-delete');
const deleteModal       = document.querySelector('.delete-modal');
const confirmDeleteBtn  = document.querySelector('.btn-confirm-delete');
const cancelDeleteBtn   = document.querySelector('.btn-cancel-delete');

//3.  FUNCTIONS ===
function openDeleteModal() {
    deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    deleteModal.classList.add('hidden');
}

//4.  EVENTS ===
deleteBtn.addEventListener('click', function(){
    if(!selectedItem){
        showNotification(`❌ ${t('noItemSelected')}`, 'error')
        return;
    } 

     // Otvori confirmation modal
    openDeleteModal();
})
cancelDeleteBtn.addEventListener('click', function(){
    closeDeleteModal();
})
confirmDeleteBtn.addEventListener('click', async function () {

    if (!selectedItem) return;

    const itemId = selectedItem.id;

    // 1. obriši logove
    await supabaseClient
        .from('item_logs')
        .delete()
        .eq('item_id', itemId)
        .eq('user_id', currentUser.id);

    // 2. obriši item
    const { error } = await supabaseClient
        .from('items')
        .delete()
        .eq('id', itemId);

    if (error) {
        console.error(error);
        showNotification(`❌ ${error.message}`, 'error');
        return;
    }

    showNotification(`✔ ${t('deleteInfo')}`, 'success')

    // refresh UI
    await fetchItems();

    selectedItem = null;
    resetDisplay();

    closeDeleteModal()
});

// -------------------- FEATURE: TOGGLE MORE --------------------
//1.  SELECTORS ===
const toggleMoreBtn = document.getElementById('toggle-more');
const optionalFields = document.getElementById('optional-fields');

//4.  EVENTS ===
toggleMoreBtn.addEventListener('click', function () {
    optionalFields.classList.toggle('open');

    if (optionalFields.classList.contains('open')) {
        toggleMoreBtn.textContent = t('toggleHide');
    } else {
        toggleMoreBtn.textContent = t('toggleMore');
    }
});






// ========================================================== TABLE ==========================================================

// -------------------- FEATURE: TABLE VIEW --------------------
//1.  SELECTORS ===
const tableWrapper      = document.querySelector('.table-wrapper');
const tableBody         = document.querySelector('.table-body');


//3.  FUNCTIONS ===
function renderTable() {

    tableBody.innerHTML = '';

    const totalPages = Math.ceil(items.length / itemsPerPage) || 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    const pageItems = items.slice(start, end);

    if (pageItems.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4">${t('noItems')}</td></tr>`;
    } else {

        pageItems.forEach(item => {

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${item.name}</td>
                <td>${item.code}</td>
                <td>${item.location}</td>
                <td>${item.quantity} pcs</td>
                <td>${item.status}</td>
                <td>${item.price} RSD</td>
                <td>${item.limit} </td>
            `;

            tr.addEventListener('click', function () {
                selectItem(item);
                goToInputTab();
            });

            tableBody.appendChild(tr);
        });
    }

    pageinfo.textContent = `Page ${currentPage} / ${totalPages}`;

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}
function goToInputTab() {
    document.querySelector('[data-tab="input"]').click();
    clearBtn.style.display = 'block';
}


// -------------------- FEATURE: PAGINATION --------------------
//1.  SELECTORS ===
const prevBtn           = document.querySelector('.prev-btn');
const nextBtn           = document.querySelector('.next-btn');
const pageinfo          = document.querySelector('.page-info');

//3.  FUNCTIONS ===
function setupPagination() {

    prevBtn.addEventListener('click', function () {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextBtn.addEventListener('click', function () {

        const totalPages = Math.ceil(items.length / itemsPerPage);

        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
}



// ========================================================== MANAGEMENT ==========================================================

// -------------------- FEATURE: CARDS - TOTALS -------------------
//1.  SELECTORS ===
const totalItemsEl      = document.getElementById('total-items');
const totalQuantityEl   = document.getElementById('total-quantity');
const totalPriceEl      = document.getElementById('total-price');
const lowStockCard      = document.getElementById('low-stock-count');

//3.  FUNCTIONS ===
// ===== GLVAN F za UPISVANJE inf u KARTICE
function updateDashboardCards() {

    // TOTAL ITEMS
    const totalItems = items.length;
    totalItemsEl.textContent = totalItems;


    //Broj  TOTAL QUANTITY
    const totalQuantity = items.reduce((sum, item) => {
        return sum + Number(item.quantity);
    }, 0);

    totalQuantityEl.textContent = totalQuantity;


    //Broj  TOTAL PRICE
    const totalPrice = items.reduce((sum, item) => {
        return sum + Number(item.price);
    }, 0);

    totalPriceEl.textContent = totalPrice.toLocaleString();


    // Broj LOW STOCK Itema
    const lowStock = items.filter(item => {
        return Number(item.quantity) < Number(item.limit);
    });

    const lowStockCount = lowStock.length;
    lowStockCard.textContent = lowStockCount;


    // TREND UPDATE (BEZ SIDE EFFECTA)
    updateTrend("items-trend", totalItems, "items");
    updateTrend("quantity-trend", totalQuantity, "quantity");
    updateTrend("price-trend", totalPrice, "price");
    updateTrend("lowstock-trend", lowStockCount, "lowstock");
}


// -------------------- FEATURE: CARDS - TRENDS -------------------
//2.  STATE ===
//  load poslednjeg prikazanog trenda
let savedTrends = {};

let previousTotals = {
    items: null,
    quantity: null,
    price: null,
    lowstock: null
};


//3.  FUNCTIONS ===

// Ucitavanje Trenda
async function loadUserTrends() {

    const data = await loadUserSetting('trendUI');

    savedTrends = data || {};

    //  odmah primeni na UI
    Object.keys(savedTrends).forEach(key => {

        const el = document.getElementById(key + "-trend");
        if (!el) return;

        const arrow = el.querySelector(".trend-arrow");
        const value = el.querySelector(".trend-value");
        const date  = el.querySelector(".trend-date");

        const trend = savedTrends[key];

        el.className = trend.className;
        arrow.textContent = trend.arrow;
        value.textContent = trend.value;

        if (trend.date && date) {
            date.textContent = formatDate(new Date(trend.date));
        }
    });
}
// Ispisivanje Trenda
function updateTrend(elementId, currentValue, key) {

    const el = document.getElementById(elementId);
    if (!el) return;

    const arrow = el.querySelector(".trend-arrow");
    const value = el.querySelector(".trend-value");
    const date  = el.querySelector(".trend-date");

    const prev = previousTotals[key];

    if (prev === null || prev === 0) {
        previousTotals[key] = currentValue;
        return;
    }

    const diff = currentValue - prev;
    const percent = ((diff / prev) * 100).toFixed(1);

    const isNegativeMetric = (key === "lowstock");

    let className, arrowText, valueText;

    if (diff > 0) {
        className = isNegativeMetric ? "card-trend down" : "card-trend up";
        arrowText = "▲";
        valueText = `+${diff} (${percent}%)`;

    } else if (diff < 0) {
        className = isNegativeMetric ? "card-trend up" : "card-trend down";
        arrowText = "▼";
        valueText = `${diff} (${percent}%)`;

    } else {
        return;
    }

    const now = new Date(); //  BITNO

    el.className        = className;
    arrow.textContent   = arrowText;
    value.textContent   = valueText;

    if (date) {
        date.textContent = formatDate(now);
    }

    savedTrends[key] = {
        className,
        arrow: arrowText,
        value: valueText,
        date: now.toISOString()
    };

    saveUserSetting('trendUI', savedTrends);

    previousTotals[key] = currentValue;
}
//Formatiranje datuma
function formatDate(date) {
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// -------------------- FEATURE: LOW STOCK TABLE -------------------
//1.  SELECTORS ===
const tableBodyDash     = document.querySelector('.table-body-dashboard');

//3.  FUNCTIONS ===
// Reder Low stock Tabele
function renderLowStockTable() {

    // koristimo LIMIT PO ITEMU
    const lowStock = items.filter(item => {
        return Number(item.quantity) < Number(item.limit);
    });

    // kartica (Low Stock)
    lowStockCard.textContent = lowStock.length ;

    tableBodyDash.innerHTML = '';

    if (lowStock.length === 0) {
        tableBodyDash.innerHTML =
            `<tr><td colspan="4">${t('NoLowStockItems')}</td></tr>`;
        return;
    }

    lowStock.forEach(item => {

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.code}</td>
            <td>${item.location}</td>
            <td>${item.quantity}</td>
            <td>${item.limit}</td>
        `;

        tr.addEventListener('click', function () {
            selectItem(item);
            goToInputTab();
        });

        tableBodyDash.appendChild(tr);
    });
}



// ========================================================== GLOBAL UI ==========================================================
// -------------------- FEATURE: NAVIGATION --------------------
//1.  SELECTORS ===
const nav               = document.querySelector('.navigation');

//4.  EVENTS ===
// Navigacija
nav.addEventListener('click', function (event) {

    const selectedTab = event.target.closest('.tab');
    if (!selectedTab) return;

    activateTab(selectedTab);

});
function activateTab(tabElement) {

    // prvo uzmi tabName
    const tabName = tabElement.dataset.tab;

    // Ako se izadje iz INPUT taba resetuj odabtani item
    if (tabName !== 'input') {
        resetDisplay();
    }

    // ACTIVE TAB
    nav.querySelectorAll('.tab').forEach(btn =>
        btn.classList.remove('active')
    );

    tabElement.classList.add('active');

    // VIEW SWITCH
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active-view');
    });

    document
        .getElementById(tabName + '-view')
        .classList.add('active-view');

    if (tabName === 'table') {
        renderTable();
    }
}



// -------------------- FEATURE: SIDEBAR --------------------
//1.  SELECTORS ===
const Burgerbtn = document.getElementById("user-btn");
const sidebar   = document.getElementById("sidebar");
const closeBtn  = document.getElementById("close-sidebar");


//4.  EVENTS ===
//Otvaranje
Burgerbtn.addEventListener("click", () => {
    sidebar.classList.remove("hidden");
});
//X
closeBtn.addEventListener("click", () => {
    sidebar.classList.add("hidden");
});
//klik spolja zatvaranje menia
document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !Burgerbtn.contains(e.target)) {
        sidebar.classList.add("hidden");
    }
});

// -------------------- FEATURE: SWIPE --------------------
//1.  SELECTORS ===
const swipeArea         = document.body;

//2.  STATE ===
//Mobile Swipe
let touchStartX = 0;
let touchEndX = 0;
let isScrollingTable = false;

//3.  FUNCTIONS ===
function handleSwipe(){

    const diff = touchStartX - touchEndX;

    // minimalna distanca da bi bio swipe
    const threshold = 50;

    if (Math.abs(diff) < threshold) return;

    // uzimamo sve tabove
    const tabs = Array.from(nav.querySelectorAll('.tab'));

    // koji je trenutno aktivan
    const activeIndex = tabs.findIndex(tab =>
        tab.classList.contains('active')
    );

    // Swipe LEFT → sledeći tab
    if (diff > 0){
        const nextIndex = activeIndex + 1;

        if (nextIndex < tabs.length){
            activateTab(tabs[nextIndex]); //  koristi tvoju postojeću logiku
        }
    }

    // Swipe RIGHT → prethodni tab
    if (diff < 0){
        const prevIndex = activeIndex - 1;

        if (prevIndex >= 0){
            activateTab(tabs[prevIndex]); //  koristi tvoju postojeću logiku
        }
    }
}
//4.  EVENTS ===
swipeArea.addEventListener('touchstart', function(e){

if (e.target.closest('.table-wrapper') || e.target.closest('.low-stock-wrapper')) {
    isScrollingTable = true;
    return;
}
    isScrollingTable = false;
    touchStartX = e.changedTouches[0].clientX;
});

// kada pusti prst
swipeArea.addEventListener('touchend', function(e){

    if (isScrollingTable) return;

    touchEndX = e.changedTouches[0].clientX;
    handleSwipe();
});

// -------------------- FEATURE: i18n (LANGUAGE SYSTEM) --------------------
//1.  SELECTORS ===
const langButtons = document.querySelectorAll('.lang-btn');

//2.  STATE ===
// Defultni jezik app je SR
let currentLang = 'en'; // default
const translations = {

    sr: {
        input: "ULAZ",
        table: "TABELA",
        management: "UPRAVLJANJE",

        save: "Sačuvaj",
        edit: "Izmeni",
        delete: "Obriši",
        cancel: "Otkaži",
        add: "+Dodaj",

        prev: "◀ Nazad",
        next: "Napred ▶",

        saved: "Sačuvano",
        errorFill: "Popuni sva polja!",
        added: "Dodat",
        updated: "izmenjen",
        noItemSelected: "Artikal nije selektovan!",
        deleteInfo: "Deo je uspesno obrisan!",

        deleteTittle: "Obriši Deo",
        deleteMessage1: "Ovim ćete trajno izbrisati stavku i CELU njenu istoriju.",
        deleteMessage2: "⚠ Ova radnja se ne može poništiti!",

        editTitle: "Izmeni artikal",
        noItems: "Nema artikala",

        searchTitle: "Pretraga artikla",
        searchPlaceholder: "Unesi naziv ili šifru...",

        itemName: "Ime:",
        ItemCode: "Kod:",
        ItemStatus: "Status:",
        ItemLocation: "Lokacija:",
        ItemPrice: "Cena:",
        ItemQuantity: "Količina:",

        tableTitle: "Tabela artikala",
        colName: "IME",
        colCode: "KOD",
        colLocation: "LOKACIJA",
        colQuantity: "KOLIČINA",
        colStatus: "STATUS",
        colPrice: "CENA",

        MangTitle: "Panel Upravljanja",

        addModulTitle: "Dodaj novi artikal",

        addModuleName: "Naziv *",
        addModuleCode: "Šifra",
        addModuleLocation: "Lokacija",
        addModuleQuantity: "Količina *",
        addModuleStatus:"Status",
        addModulePrice: 'Cena *',
        historyLog: "Istorija Dela",
        noHistoryYet:"Bez izmena...",

        created: "Kreirano: ",

        TotalItems:"Ukupno Artikla ",
        TotalQuantity:"Ukupna Kolicina ",
        TotalPrice:"Ukupno Novca ",
        LowStock: "Male Zalihe ",

        LowStockItems: "Stavke sa malim zalihama",

        //LogIN / REGISTARTION

        auth_title: "Registracija",
        auth_subtitle: "Registruj se da koristiš aplikaciju",

        auth_email: "Email",
        auth_password: "Lozinka",

        auth_email_placeholder: "Unesi email",
        auth_password_placeholder: "Unesi lozinku",

        auth_register: "Registruj se",
        auth_login: "Prijava",

        auth_switch_text: "Već imaš nalog?",

        auth_login_title: "Prijava",
        auth_login_subtitle: "Unesi svoje podatke",

        auth_no_account: "Nemaš nalog?",
        auth_have_account: "Već imaš nalog?",

        // AUTH NOTIFICATIONS
        auth_fill_fields: "Popuni sva polja",
        auth_invalid_email: "Neispravan format email-a",
        auth_password_short: "Lozinka mora imati najmanje 6 karaktera",

        auth_user_exists: "Korisnik već postoji",
        auth_too_many: "Previše pokušaja. Pokušaj kasnije",

        auth_registered: "Nalog uspešno kreiran",
        auth_login_fill: "Unesi email i lozinku",
        auth_wrong_credentials: "Pogrešan email ili lozinka",
        auth_logged_in: "Uspešna prijava",

        // SIDEBAR
        sidebar_menu: "Meni",
        sidebar_profile: "Profil",
        sidebar_settings: "Podešavanja",
        sidebar_logout: "Odjava",

        //SECTION TITLE
        selectedItem: "Izabrani artikal",
        adjustQuantity: "Izmena količine",
        lowStockItems: "Artikli sa malim zalihama",

        //ToggleBTN
        toggleMore: "+ Vise",
        toggleHide: "- Sakri",

        NoLowStockItems: "Bez kritičnih artikala"



    },

    en: {
        input: "INPUT",
        table: "TABLE",
        management: "MANAGEMENT",

        save: "Save",
        edit: "Edit",
        delete: "Delete",
        cancel: "Cancel",
        add: "+Add",

        prev: "◀ Back",
        next: "Next ▶",

        saved: "Saved",
        errorFill: "Fill in all fields!",
        added: "Added",
        updated: "Updated",
        noItemSelected: "Item is not Select!",
        deleteInfo: "Item is successfully deleted!",

        deleteTittle: "Delete Item",
        deleteMessage1: "This will permanently delete the item and ALL its history.",
        deleteMessage2: "⚠ This action cannot be undone.",

        editTitle: "Edit item",
        noItems: "No items",

        searchTitle: "Item search",
        searchPlaceholder: "Enter name or code...",

        itemName: "Name:",
        ItemCode: "Code:",
        ItemStatus: "Status:",
        ItemLocation: "Location:",
        ItemPrice: "Price:",
        ItemQuantity: "Quantity:",

        tableTitle: "Items table",
        colName: "NAME",
        colCode: "CODE",
        colLocation: "LOCATION",
        colQuantity: "QUANTITY",
        colStatus: "STATUS",
        colPrice: "PRICE",

        MangTitle: "Management panel",

        addModulTitle: "Add new item",

        addModuleName: "Name *",
        addModuleCode: "Code",
        addModuleLocation: "Location",
        addModuleQuantity: "Quantity *",
        addModuleStatus:"Status",
        addModulePrice: 'Price *',
        historyLog: "History Log",
        noHistoryYet:"No History jet...",

        created: "Created: ",

        TotalItems:"Total Items ",
        TotalQuantity:"Total Quantity ",
        TotalPrice:"Total Price ",
        LowStock: "Low Stock ",

        LowStockItems: "Low Stock Items",

        //LogIN / REGISTARTION

        auth_title: "Create Account",
        auth_subtitle: "Sign up to start using the app",

        auth_email: "Email",
        auth_password: "Password",

        auth_email_placeholder: "Enter your email",
        auth_password_placeholder: "Enter your password",

        auth_register: "Register",
        auth_login: "Login",

        auth_switch_text: "Already have an account?",

        
        auth_login_title: "Login",
        auth_login_subtitle: "Enter your credentials",

        auth_no_account: "Don't have an account?",
        auth_have_account: "Already have an account?",

        // AUTH NOTIFICATIONS
        auth_fill_fields: "Fill all fields",
        auth_invalid_email: "Invalid email format",
        auth_password_short: "Password must be at least 6 characters",

        auth_user_exists: "User already exists",
        auth_too_many: "Too many attempts. Try later",

        auth_registered: "Account created successfully",
        auth_login_fill: "Enter email and password",
        auth_wrong_credentials: "Wrong email or password",
        auth_logged_in: "Logged in successfully",

        // SIDEBAR
        sidebar_menu: "Menu",
        sidebar_profile: "Profile",
        sidebar_settings: "Settings",
        sidebar_logout: "Logout",

        //SECTION TITLE
        selectedItem: "Selected Item",
        adjustQuantity: "Adjust Quantity",
        lowStockItems: "Low Stock Items",

        //ToggleBTN
        toggleMore: "+ More",
        toggleHide: "- Hide",

        NoLowStockItems: "No Low Stock items"



      
    }

};

//3.  FUNCTIONS ===
// Ucitavanje jezika iz Superbase
async function loadUserLanguage() {
    const savedLang = await loadUserSetting('language');

    if (savedLang) {
        currentLang = savedLang;
    }

    applyTranslations();
    updateActiveLang();
}
// Vraća prevod za dati key
function t(key){

    // 1. pokušaj trenutni jezik
    if (translations[currentLang] && translations[currentLang][key]) {
        return translations[currentLang][key];
    }

    // 2. fallback na engleski
    if (translations.en && translations.en[key]) {
        return translations.en[key];
    }

    // 3. fallback -> vrati key
    return key;
}
// Prolazi kroz HTML i menja tekstove
function applyTranslations(){

    // TEXT (inner text)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        el.textContent = t(key);
    });

    // PLACEHOLDER (input polja)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        el.placeholder = t(key);
    });
}
// Menja jezik + pamti + refresh UI
async function setLang(lang){

    currentLang = lang;

    await saveUserSetting('language', lang);

    applyTranslations();
    updateActiveLang();
}
// Postavlja koji jezik je aktivan (UI)
function updateActiveLang(){

    langButtons.forEach(btn => {

        if (btn.dataset.lang === currentLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

    });
}

//4.  EVENTS ===
// klik na dugmad
langButtons.forEach(btn => {

    btn.addEventListener('click', function(){

        const lang = btn.dataset.lang;

        setLang(lang); // promena jezika

    });

});


// -------------------- FEATURE: NOTIFICATIONS --------------------
//1.  SELECTORS ===
const notification      = document.querySelector('.notification');

//3.  FUNCTIONS ===
function showNotification(message, type) {


notification.textContent = message;

notification.classList.remove('success', 'error', 'info');
notification.classList.add(type);

setTimeout(() => {
    notification.classList.remove(type);
}, 3000);

}





// ========================================================== INICIALISATION ==========================================================

// PAGINATION INIT
setupPagination();

updateAuthUI();

//UMESTO fetchItems
initUser();

// Planiramo da implementiramo feature Prijemnice kao poseban modul (screen), bez menjanja postojećeg sistema za Add/Edit itema. 
// Postojeći modal (koji već koristimo za dodavanje i izmenu jednog artikla preko editMode) ostaje potpuno isti i koristi se kao 
// alat unutar prijemnice. 
// 
// Novi flow će biti sledeći: 
// korisnik klikne “Prijem robe”, otvori se modul prijemnice koji prikazuje, naslov, podnaslov,
// praznu listu gde ce dodati itemi biti kanije prikzani sa Delete dugmetom, checkbox "Kreiraj PDF Izvestaj" i dugme “+ Dodaj artikal”. 
// Klikom na to dugme “+ Dodaj artikal” otvara se postojeći modal za unos artikla; kada korisnik klikne 
// Save u tom modalu, umesto da se podatak odmah šalje u bazu, taj artikal se dodaje u lokalnu listu (prijemnica.items), sto zaci da
// da se taj item prikazuje u listi u Prijemnici. 
// Nakon toga forma se resetuje (inputi se brišu, fokus se vraća na prvo polje), ali modal ostaje otvoren kako bi korisnik 
// mogao brzo da unese sledeći artikal bez dodatnih klikova. U isto vreme korisnik može videti ažuriranu listu u 
// prijemnici (ili se informisati kroz notifikaciju da je artikal dodat). Taj proces može ponavljati više puta dok ne 
// unese sve potrebne artikle. Kada završi unos, korisnik može zatvoriti modal i vratiti se na pregled prijemnice gde vidi
//  kompletnu listu stavki. Na kraju, klikom na glavno dugme SAVE u prijemnici svi artikli iz liste se obrađuju
//   (insert u bazu za nove artikl"items"e, kreiranje transaction objekta, update stanja). Dodatno, u prijemnici postoji checkbox
//    za generisanje PDF‑a (UI sada, logika kasnije).