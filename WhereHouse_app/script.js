
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://ndnljnalwqpnsdnnjoql.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G7GepZscofTzQmzyoMmo0Q_0bD6zH0c';

//  PREIMENOVAN CLIENT
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);


//  items BASE
const items = [];

let currentUser = null;
let authLoading = false;
let isLoginMode = false;

async function fetchItems() {

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

// REGISTER
async function register(email, password) {

    if (authLoading) return;

    authLoading = true;

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    console.log("REGISTER RESULT:", data, error);

    if (error) {

        // ✅ OVDE IDE
        if (error?.message.includes('rate limit')) {
            showNotification('Too many attempts. Try again later.', 'error');
        } else {
            showNotification(error.message, 'error');
        }

        authLoading = false;
        return;
    }

    showNotification('Account created!', 'success');

    authLoading = false;
}

// LOGIN
async function login(email, password) {

    if (authLoading) return;

    authLoading = true;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    console.log("LOGIN RESULT:", data, error);

    if (error) {
        if (error?.message.includes('Invalid login credentials')) {
            showNotification('Wrong email or password', 'error');
        } else {
            showNotification(error.message, 'error');
        }

        authLoading = false;
        return;
    }

    showNotification('Logged in!', 'success');

    // KLJUČNA LINIJA
    currentUser = data.user;
    startApp();

    authLoading = false;
}

// LOGOUT
async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}
const logoutBtn = document.getElementById('logout-btn');
logoutBtn.addEventListener('click', logout);


async function initUser() {
    const { data } = await supabaseClient.auth.getUser();
    currentUser = data.user;

    if (!currentUser) {
        showAuthScreen();
        return;
    }

    startApp();
}

// ====================================== OTAVRANJE Side Menija ============================
const Burgerbtn = document.getElementById("user-btn");
const sidebar   = document.getElementById("sidebar");
const closeBtn  = document.getElementById("close-sidebar");

Burgerbtn.addEventListener("click", () => {
    sidebar.classList.remove("hidden");
});

closeBtn.addEventListener("click", () => {
    sidebar.classList.add("hidden");
});

//klik spolja zatvaranje menia
document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !Burgerbtn.contains(e.target)) {
        sidebar.classList.add("hidden");
    }
});





function showAuthScreen() {
    authScreen.style.display = 'flex';
    appWrapper.classList.add('hidden');
}
function startApp() {
    authScreen.style.display = 'none';
    appWrapper.classList.remove('hidden');

    fetchItems();
}

//za Log (prilikom promen samo Kolicni pa odmah Save)
let originalQuantity = null;

// ================================ LOG IN / REGISTARTION
const appWrapper    = document.getElementById('app');
const authScreen    = document.getElementById('auth-screen');

const authTitle     = document.getElementById('auth-title');
const authSubtitle  = document.getElementById('auth-subtitle');

const emailInput    = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');

const authMainBtn   = document.getElementById('auth-main-btn');
const switchMode    = document.getElementById('switch-mode');
const switchLabel   = document.getElementById('auth-switch-label');

const authCard      = document.querySelector('.auth-card');

function updateAuthUI() {

    if (isLoginMode) {

        authCard.classList.add('login-mode');

        // ✅ menjamo KLJUČ
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

    // ✅ NAJBITNIJE — refresh prevoda
    applyTranslations();
}


authMainBtn.addEventListener('click', () => {

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // basic validation
    if (!email || !password) {
        showNotification('Enter email and password', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password minimum 6 characters', 'error');
        return;
    }

    if (isLoginMode) {
        login(email, password);
    } else {
        register(email, password);
    }
});
switchMode.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    updateAuthUI();
});
passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        authMainBtn.click();
    }
});



/* ============================================================
   2. SELECTORS
============================================================ */

// NAV
const nav               = document.querySelector('.navigation');

// INPUT
const input             = document.querySelector('#input-search');
const clearBtn          = document.querySelector('.clear-btn');
const resultsContainer  = document.querySelector('.results');

// ITEM DISPLAY
const itemName          = document.getElementById('item-name');
const itemCode          = document.getElementById('item-code');
const itemStatus        = document.getElementById('item-status');
const itemLocation      = document.getElementById('item-location');
const itemPrice         = document.getElementById('item-price')
const ItemLimit         = document.getElementById('item-limit')
const quantityValue     = document.getElementById('quantity-value');

const plusBtn           = document.querySelector('.btn-plus');
const minusBtn          = document.querySelector('.btn-minus');

const saveBtn           = document.querySelector('.save-btn');
const notification      = document.querySelector('.notification');

// TABLE
const tableWrapper      = document.querySelector('.table-wrapper');
const tableBody         = document.querySelector('.table-body');
const prevBtn           = document.querySelector('.prev-btn');
const nextBtn           = document.querySelector('.next-btn');
const pageinfo          = document.querySelector('.page-info');

//ADD ITEM FORM

const modal             = document.querySelector('.modal');
const addOpenBtn        = document.querySelector('.btn-add');

const addSave           = document.querySelector('.btn-save');
const addCancel         = document.querySelector('.btn-cancel');


const newName           = document.getElementById('new-name');
const newCode           = document.getElementById('new-code');
const newStatus         = document.getElementById('new-status');
const newLocation       = document.getElementById('new-location');
const newPrice          = document.getElementById('new-price');
const newLimit          = document.getElementById('new-limit');

const newQuantity       = document.getElementById('new-quantity');

//EDIT ITEM
const editBtn           = document.querySelector('.btn-edit');
const modalTitle        = document.querySelector('.modal__title');

//DELETE ITEM
const deleteBtn         = document.querySelector('.btn-delete');
const deleteModal       = document.querySelector('.delete-modal');
const confirmDeleteBtn  = document.querySelector('.btn-confirm-delete');
const cancelDeleteBtn   = document.querySelector('.btn-cancel-delete');


// hvata celu app 
const swipeArea         = document.body;

//History Log
const historyModal      = document.querySelector('.history-modal');
const historyBtn        = document.querySelector('.btn-history');
const historyClose      = document.querySelector('.history-close');
const historyWrapper    = document.querySelector('.history-wrapper');
const ItemLog           = document.querySelector('.history-modal_itemLog')

/* ============================================================
   3. STATE
============================================================ */

let selectedItem    = null;

//Pagination
let currentPage     = 1;
const itemsPerPage  = 20;

//Edit mode
let editMode        = false;
let editItem        = null;

//Mobile Swipe
let touchStartX = 0;
let touchEndX = 0;

// Da li korisnkov dodir ekrana na tabli

// Ako korisnik počne swipe VAN tabele, ali završi GA U tabeli → aktiviraće se swipe (greška)
// Zato koristimo ovu promenljivu da zapamtimo gde je dodir POČEO
let isScrollingTable = false;


/* ============================================================
   4. EVENTS
============================================================ */

// NAVIGATION
nav.addEventListener('click', function (event) {

    const selectedTab = event.target.closest('.tab');
    if (!selectedTab) return;

    activateTab(selectedTab);

});

// SEARCH
input.addEventListener('input', handleSearch);

// CLEAR
clearBtn.addEventListener('click', function () {
    resetDisplay();
    clearResults();
});

// QUANTITY
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


//  SAVE (INPUT TAB - CHANGE QUANTITY) ===============================================
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

    // ✅ 4. UPDATE U BAZI
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







// NEW ITEM FORM
//Opne
addOpenBtn.addEventListener('click', function(){
    modal.classList.remove('hidden');
    newName.focus();
});

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
    if (!name || !code || !status || !location || quantityRaw === ''|| isNaN(quantity)|| priceRow === ''|| isNaN(price) ) {
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


        // ✅ UPDATE ITEM
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

//helper f
function resetForm(){
    newName.value = '';
    newCode.value = '';
    newStatus.value = '';
    newLocation.value = '';
    newQuantity.value = '';
    newPrice.value = '';
    newLimit.value = '';
}

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

    showNotification(`✔ ${'deleteInfo'}`, 'success')

    // refresh UI
    await fetchItems();

    selectedItem = null;
    resetDisplay();

    closeDeleteModal()
});

function openDeleteModal() {
    deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
    deleteModal.classList.add('hidden');
}
/* ============================================================
   SWIPE NAVIGATION (MOBILE)
============================================================ */

swipeArea.addEventListener('touchstart', function(e){

if (e.target.closest('.table-wrapper') || e.target.closest('.low-stock-wrappe')) {
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

//========================= HISTORY LOG =========================
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
/* ============================================================
   5. SEARCH LOGIC
============================================================ */

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
        div.textContent = `${item.name} (${item.code})`;

        div.addEventListener('click', function () {
            selectItem(item);
        });

        resultsContainer.appendChild(div);
    });
}

function clearResults() {
    resultsContainer.innerHTML = '';
}

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


/* ============================================================
   6. ITEM SELECTION
============================================================ */

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


/* ============================================================
   7. TABLE + PAGINATION
============================================================ */

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
/* ============================================================
   8. KREIRANJE LOGOVA U MODULU
============================================================ */
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

        // ✅ FORMATIRANJE PO TIPU
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
/* ============================================================
   8. UTILITIES
============================================================ */

function goToInputTab() {
    document.querySelector('[data-tab="input"]').click();
    clearBtn.style.display = 'block';
}

function showNotification(message, type) {


notification.textContent = message;

notification.classList.remove('success', 'error', 'info');
notification.classList.add(type);

setTimeout(() => {
    notification.classList.remove(type);
}, 3000);

}
function activateTab(tabElement) {

    // ACTIVE TAB
    nav.querySelectorAll('.tab').forEach(btn =>
        btn.classList.remove('active')
    );

    tabElement.classList.add('active');

    // VIEW SWITCH
    const tabName = tabElement.dataset.tab;

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
    console.log('LOG:', itemId, field, oldVal, newVal);
}

/* ============================================================
   9. i18n (LANGUAGE SYSTEM)
============================================================ */


// Uzimamo jezik iz localStorage ili default "sr"
let currentLang = localStorage.getItem('lang') || 'sr';


// Dugmad za izbor jezika (SR / EN)
const langButtons = document.querySelectorAll('.lang-btn');


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

        addModuleName: "Naziv",
        addModuleCode: "Šifra",
        addModuleLocation: "Lokacija",
        addModuleQuantity: "Količina",
        addModuleStatus:"Status",
        addModulePrice: 'Cena',
        historyLog: "Istorija Dela",
        noHistoryYet:"Bez izmena...",

        created: "Kreirano: ",

        TotalItems:"Ukupno Stavki: ",
        TotalQuantity:"Ukupna Kolicina: ",
        TotalPrice:"Ukupno Novca: ",
        LowStock: "Male Zalihe: ",

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
        auth_have_account: "Već imaš nalog?"


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

        addModuleName: "Name",
        addModuleCode: "Code",
        addModuleLocation: "Location",
        addModuleQuantity: "Quantity",
        addModuleStatus:"Status",
        addModulePrice: 'Price',
        historyLog: "History Log",
        noHistoryYet:"No History jet...",

        created: "Created: ",

        TotalItems:"Total Items: ",
        TotalQuantity:"Total Quantity: ",
        TotalPrice:"Total Price: ",
        LowStock: "Low Stock: ",

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
        auth_have_account: "Already have an account?"


      
    }

};

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
function setLang(lang){

    currentLang = lang;
    
    localStorage.setItem('lang', lang); // zapamti izbor
    applyTranslations(); // primeni prevod
    updateActiveLang(); // update active dugme
}

// EVENTS (klik na dugmad)
langButtons.forEach(btn => {

    btn.addEventListener('click', function(){

        const lang = btn.dataset.lang;

        setLang(lang); // promena jezika

    });

});

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

/* ==================================== 10. DEASHBORD ==================================== */

const totalItemsEl      = document.getElementById('total-items');
const totalQuantityEl   = document.getElementById('total-quantity');
const totalPriceEl      = document.getElementById('total-price');

const tableBodyDash     = document.querySelector('.table-body-dashboard');
const lowStockCard      = document.getElementById('low-stock-count');
// ============= CARDS =============
function updateDashboardCards() {

    // TOTAL ITEMS
    totalItemsEl.textContent = items.length;

    // TOTAL QUANTITY
    const totalQuantity = items.reduce((sum, item) => {
        return sum + Number(item.quantity);
    }, 0);

    totalQuantityEl.textContent = totalQuantity;

    //  TOTAL PRICE (SABIRANJE, NE MNOŽENJE)
    const totalPrice = items.reduce((sum, item) => {
        return sum + Number(item.price);
    }, 0);

    totalPriceEl.textContent = totalPrice.toLocaleString();
}
// ============ RENDER LOW STOCK ==========
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
            '<tr><td colspan="4">No low stock</td></tr>';
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






/* ============================================================
   11. INIT (pokretanje aplikacije)
============================================================ */

// Postavi active dugme posle reload-a
updateActiveLang();

// Primeni prevode odmah
applyTranslations();

// PAGINATION INIT
setupPagination();

//  UMESTO fetchItems
initUser();

updateAuthUI();