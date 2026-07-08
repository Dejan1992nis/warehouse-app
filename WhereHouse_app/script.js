// ========================================================== BACKEND ==========================================================


import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://ndnljnalwqpnsdnnjoql.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G7GepZscofTzQmzyoMmo0Q_0bD6zH0c';

// KONEKCIJA sa SUPABASE
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY); // Klijent za komunikaciju sa bazom

// TABS IMENA
const TAB = {
    ITEM: 'item',
    INVENTORY: 'inventory',
    DASHBOARD: 'dashboard',
    TRANSACTION: 'transaction'
};


async function fetchItems() {

    if (!currentUser) return;  // Ako ne postoji korisnik → prekini


    // Uzimamo podatke iz Supabase baze 
    /*-------------------------------------------

    const { data, error }

    → iz odgovora baze izdvajamo:
       - data  = podaci koje smo dobili (rezultat query-ja)
       - error = greška ako postoji

    (isto kao da pišemo:)
    const data = response.data;
    const error = response.error;

    -------------------------------------------*/


    const { data, error } = await supabaseClient  // Saljemo upit bazi i cekamo odgovor
        .from('items') // pozovi funkciju from() => podatke izvuci iz table 'items'
        .select('*')    // → na njen rezultat pozovi select() => Uzmi sve kolone iz te tabele
        .eq('user_id', currentUser.id); //→ na taj rezultat pozovi eq() => Filter: Uzmi samo redove gde se 'user_id = currentUser.id'

    if (error) {    //Ako atribut 'erorr' vrati gresku prikzai je u Dev.
        console.error(error);
        return;
    }

    // Filtriramo samo aktivne iteme
    const activeItems = data.filter(function(item) {
        return item.is_active !== false;  // vrati item iz kolone is_active.true
    });

    items.length = 0;
    items.push(...activeItems);

    updateDashboardCards();
    renderInventoryTable();
    updateInventoryStats();
    renderLowStockTable();
}
//  uzima sve logove za jedan item sortira ih (najnoviji prvi)
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
async function addLog(itemId, field, oldVal, newVal, transactionId = null) {

    const { error } = await supabaseClient
        .from('item_logs')
        .insert([{
            item_id: itemId,
            field: field,
            old_value: String(oldVal),
            new_value: String(newVal),
            user_id: currentUser.id,
            transaction_id: transactionId  
        }]);

    if (error) {
        console.error('LOG ERROR:', error);
    }
}

//-------------- My Cy & My Partners --------------
async function fetchCompanies() {
    const { data, error } = await supabaseClient
        .from('companies')
        .select('*')
        .eq('user_id', currentUser.id);

    if (!error) companies = data || [];
}

async function fetchPartners() {
    const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('user_id', currentUser.id);

    if (!error) partners = data || [];
}
function populateDropdownsQuick() {

    const wSelect = document.getElementById('quick-company');
    const pSelect = document.getElementById('quick-partner');

    //Refres
 wSelect.innerHTML =
`<option value="" selected disabled>${t("sidebar_Cy")}</option>`;

pSelect.innerHTML =
`<option value="" selected disabled>${t("sidebar_Partner")}</option>`;
    if (!wSelect || !pSelect) return;



    companies.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name;
        wSelect.appendChild(opt);
    });

    partners.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        pSelect.appendChild(opt);
    });
}

// ========================================================== GLOBAL VARIABLES ==========================================================
const items             = [];
let transactions        = [];

let currentUser         = null;
let selectedItem        = null;
let originalQuantity    = null;
let tempQuantity        = 0;




let companies = [];
let partners = [];

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
        showNotification(`❌ ${t("auth_fill_fields")}`, 'error');
        return;
    }

    // 2. email format
    if (!isValidEmail(email)) {
        showNotification(`❌ ${t("auth_invalid_email")}`, 'error');
        return;
    }

    // 3. password length
    if (password.length < 6) {
        showNotification(`❌ ${t('auth_password_short')}`, 'error');
        return;
    }

    authLoading = true;

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

   

    if (error) {
        if (error.message.includes('User already registered')) {
            showNotification(`❌ ${t("auth_user_exists")}`, 'error');
        } else if (error.message.includes('rate limit')) {
            showNotification(`❌ ${t("auth_too_many")}`, 'error');
        } else {
            showNotification(error.message, 'error'); // može ostati raw
        }

        authLoading = false;
        return;
    }

    showNotification(`✔ ${t("auth_registered")}`, 'success');
    authLoading = false;
}
// LOGIN
async function login(email, password) {

    if (authLoading) return;

    //  1. prazna polja
    if (!email || !password) {
        showNotification(`❌ ${t('auth_login_fill')}`, 'error');
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

            showNotification(`❌ ${t('auth_wrong_credentials')}`, 'error');
        } else {
            showNotification(error.message, 'error');
        }

        authLoading = false;
        return;
    }

    // KLJUČNO — dodatna provera
    if (!data || !data.user) {
        showNotification(`❌ ${t('auth_wrong_credentials')}`, 'error');
        authLoading = false;
        return;
    }

    showNotification(`✔ ${t('auth_logged_in')}`, 'success');

    currentUser = data?.user || null;

    // await loadUserLanguage();
    // await loadUserTrends();
    // startApp();

    authLoading = false;
}
// LOGOUT
async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}
// PROVERA KORISNIKA
async function initUser() {

    // 1. koristi SESSION (BRZO i bez flicker)
    const { data: { session } } = await supabaseClient.auth.getSession();

    currentUser = session?.user || null;

    if (currentUser) {
        await startApp();
    } else {
        showAuthScreen();
    }

    // 2. ukloni loading TEK kad znamo stanje
const loader = document.getElementById('starting-loading');

if (loader) {
    loader.classList.add('fade-out');

    setTimeout(() => {
        loader.remove();
    }, 300);
}
}
supabaseClient.auth.onAuthStateChange((event, session) => {

    currentUser = session?.user || null;

    if (currentUser) {
        startApp();
    } else {
        showAuthScreen();
    }

});
// STARTOVANJE APP
async function startApp() {
    authScreen.style.display = 'none';
    appWrapper.classList.remove('hidden');

    showUserInfo();

    await loadUserLanguage();
    await loadUserTrends();

    await fetchItems();
    await fetchTransactions();

    await fetchCompanies();
    await fetchPartners();
    populateDropdownsQuick();
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

// STATE
let quickCompany = null;
let quickPartner = null;

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

    renderResults(filtered, 'input');
}

function renderResults(results, mode) {

    clearResults();

    if (results.length === 0) {

        const div = document.createElement('div');
        div.classList.add('no-results');

        const text = document.createElement('p');
        text.textContent = t('noResults');

        div.appendChild(text);

        // samo za RECEIVE!
        if (mode === 'receipt') {

            const button = document.createElement('button');
            button.classList.add('add-new-btn');
            button.textContent = t('addNewItem');

            button.addEventListener('click', () => {
                modal.classList.remove('hidden');
                addName.focus();
            });

            div.appendChild(button);
        }

        resultsContainer.appendChild(div);
        return;
    }

    results.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('result-item');

        div.textContent = `${item.name} (${item.code}) - ${item.status}`;

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

//CY_Dropdown
document.getElementById('quick-company').addEventListener('change', (e) => {
    quickCompany = e.target.value;
});
//Partner_Dropdown
document.getElementById('quick-partner').addEventListener('change', (e) => {
    quickPartner = e.target.value;
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
    tempQuantity = 0;

    // Reset Qucik CY & Partenr Dw
    quickCompany = null;
    quickPartner = null;

    document.getElementById('quick-company').value = '';
    document.getElementById('quick-partner').value = '';

}
function selectItem(item) {

    itemName.textContent        = item.name;
    itemCode.textContent        = item.code;
    itemStatus.textContent      = item.status;
    itemLocation.textContent    = item.location;
    itemPrice.textContent       = item.price;
    ItemLimit.textContent       = item.limit;

    tempQuantity = item.quantity;               // NOVO
    quantityValue.textContent = tempQuantity;   // IZMENJENO

    input.value = item.name;

    selectedItem = item;


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

    tempQuantity++;
    quantityValue.textContent = tempQuantity;
});
minusBtn.addEventListener('click', function () {
    if (!selectedItem) return;

    if (tempQuantity > 0) {
        tempQuantity--;
    }

    quantityValue.textContent = tempQuantity;
});


// -------------------- FEATURE: SAVE QUANTITY ------------------

//1.  SELECTORS ===
const saveBtn           = document.querySelector('.save-btn');

//3.  FUNCTIONS ===

//4.  EVENTS ===
saveBtn.addEventListener('click', async function () {

    // 0. VALIDACIJA DROPDOWNa
    if (!quickCompany) {
        showNotification(`⚠ ${t('selectCompany')}`, 'error');
        return;
    }

    if (!quickPartner) {
        showNotification(`⚠ ${t('selectPartner')}`, 'error');
        return;
    }
    // 1. VALIDACIJA
    if (!selectedItem) {
        showNotification(`❌ ${t('noItemSelected')}`, 'error');
        return;
    }

    // 2. STARE I NOVE VREDNOSTI
    const oldQuantity = originalQuantity;
    const newQuantity = tempQuantity;

    const diff = newQuantity - oldQuantity;

    if (diff !== 0) {

        const type = diff > 0 ? 'receipt' : 'issue';
        
        selectedCompany = quickCompany;
        selectedPartner = quickPartner;

        await createTransaction(
            [{
                id: selectedItem.id,
                qty: Math.abs(diff)
            }],
            type
        );
    }

    // 5. SUCCESS + REFRESH
    showNotification(`✔ ${selectedItem.name} ${t('saved')}`, 'success');

    await fetchItems();
    await fetchTransactions();

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
const ItemLog           = document.querySelector('.history-modal_itemLog')
//2.  STATE ===
//3.  FUNCTIONS ===
function renderLogs(logs) {

    const container = document.querySelector('.history-modal__body');
    //Naziv Item za koji geldamo LogHistory
    ItemLog.textContent = selectedItem ? selectedItem.name : t('noItems');

    container.innerHTML = '';

    if (!logs || logs.length === 0) {
        container.textContent = `${t('noHistoryYet')}`;
        return;
    }

    logs.forEach(log => {

        const div = document.createElement('div');
        div.classList.add('history-item');

        let text = '';
        let date = new Date(log.created_at).toLocaleString('sr-RS', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

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

        // ================= TRANSACTION LINE =================
        let txLine = '';


        if (log.transaction_id) {
            txLine = `<div class="log-tx">${t('transactionID')} #${log.transaction_id}</div>`;
        }

        // ================= RENDER =================
        div.innerHTML = `
            <div class="log-row">
                <span class="log-main">${text}</span>
                <span class="log-date">${date}</span>
            </div>
            ${txLine}
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

// ===== ADD MODAL =====
const modal = document.querySelector('.add-modal');

const addSaveBtn = document.getElementById('add-save');
const addCancelBtn = document.getElementById('add-cancel');

const addName = document.getElementById('add-name');
const addQty = document.getElementById('add-quantity');
const addPrice = document.getElementById('add-price');
const addLimit = document.getElementById('add-limit');
const addCode = document.getElementById('add-code');
const addStatus = document.getElementById('add-status');

const addToggleBtn = document.getElementById('add-toggle-more');
const addOptional = document.getElementById('add-optional-fields');

// LOACTION INPUT
const addLocationSelector = document.getElementById('add-location-selector');

let locationState = {

    warehouse: null,
    zone: null,
    rack: null,
    shelf: null
};

let activeLocationStep = 'warehouse';
function updateLocationInfo() {

    const title =
        document.getElementById('location-step-title');

    const desc =
        document.getElementById('location-step-desc');

    switch (activeLocationStep) {

        case 'warehouse':

            title.textContent = 'Warehouse';
            desc.textContent = 'Select warehouse location';
            break;

        case 'zone':

            title.textContent = 'Zona';
            desc.textContent = 'Odaberi zonu u skladištu';
            break;

        case 'rack':

            title.textContent = 'Regala (broj u zoni)';
            desc.textContent = 'Broj regale konstrukcije unutar odabrane zone';
            break;

        case 'shelf':

            title.textContent = 'Polica (nivo visine)';
            desc.textContent = 'Nivo police od dna prema vrhu';
            break;
    }

}
// REDER LOACTION F
function renderLocationSelector() {

    addLocationSelector.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'location-option-grid';

    let options = [];

    switch (activeLocationStep) {

        case 'warehouse':

            options = Array.from(
                { length: 10 },
                (_, i) => `W${i + 1}`
            );

            break;

        case 'zone':

            options = [
                'A','B','C',
                'D','E','F',
                'G','H'
            ];

            break;

        case 'rack':

            options = Array.from(
                { length: 20 },
                (_, i) =>
                    String(i + 1)
                        .padStart(2, '0')
            );

            break;

        case 'shelf':

            options = [
                '1','2','3',
                '4','5','6'
            ];

            break;
    }

    options.forEach(value => {

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'location-option';
        btn.textContent = value;

        if (locationState[activeLocationStep] === value) {
            btn.classList.add('selected');
        }
        btn.addEventListener('click', () => {

            locationState[activeLocationStep] = value;

            document
                .querySelector(`[data-step="${activeLocationStep}"] .segment-value`)
                .textContent = value;

            const nextStep = {
                warehouse: 'zone',
                zone: 'rack',
                rack: 'shelf'
            };

            const next = nextStep[activeLocationStep];

            if (next) {

                document
                    .querySelectorAll('.location-segment')
                    .forEach(btn =>
                        btn.classList.remove('active')
                    );

                activeLocationStep = next;

                document
                    .querySelector(`[data-step="${next}"]`)
                    .classList.add('active');

                updateLocationInfo();
            }

            renderLocationSelector();
        });

            

        grid.appendChild(btn);

    });

    addLocationSelector.appendChild(grid);
}

document
    .querySelectorAll('.location-segment')
    .forEach(segment => {

        segment.addEventListener('click', () => {

            document
                .querySelectorAll('.location-segment')
                .forEach(btn =>
                    btn.classList.remove('active')
                );

            segment.classList.add('active');

            activeLocationStep =
                segment.dataset.step;

            updateLocationInfo();
            renderLocationSelector();
        });

    });

// SAVE → IDE SAMO U TRANSACTION 
addSaveBtn.addEventListener('click', () => {

    const name = addName.value.trim();
    const qty = Number(addQty.value);
    const price = Number(addPrice.value);
    const limit = Number(addLimit.value);




    // VALIDACIJA UNOSA prvo
    if (!name || isNaN(qty) || qty < 0 || isNaN(price) || isNaN(limit)){
        showNotification(`❌ ${t('fillRequired')}`, 'error');
        return;
    }

    //Restet COPY state
    isCopyMode = false;
    copiedItemData = null;

    // PROVERA DUPLIKATA posle što imamo name
    const exists = items.find(i => 
        i.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
        showNotification(`❌ ${t('nameExists')}`, 'error');
        return;
    }

    //VALIDACIJA za Location

        if (
        !locationState.warehouse ||
        !locationState.zone ||
        !locationState.rack ||
        !locationState.shelf
    ) {
        showNotification('❌ Select location', 'error');
        return;
    }

addToTransaction({
    id: 'tmp_' + Date.now(),
    name,
    code: addCode.value.trim(),
    status: addStatus.value.trim(),
    location:`${locationState.warehouse}-${locationState.zone}-${locationState.rack}-${locationState.shelf}`,
    warehouse_code:locationState.warehouse,
    zone_code:locationState.zone,
    rack_code:locationState.rack,
    shelf_code:locationState.shelf,
    price,
    limit,
    isNew: true,
    qty
});

    showNotification(`✔ ${t('itemAddedTx')}`, 'success');

    modal.classList.add('hidden');
   
    resetForm();
});


// CANCEL
addCancelBtn.addEventListener('click', () => {

    // Rester COPY stanja   
    isCopyMode = false;
    copiedItemData = null;

    modal.classList.add('hidden');
    resetForm();
});



function resetForm() {
    addName.value = '';
    addQty.value = '';
    addPrice.value = '';
    addLimit.value = '';
    addCode.value = '';
    addStatus.value = '';

    addOptional.classList.add('hidden');
    modal.classList.remove('child-modal');

}

// TOGGLE
addToggleBtn.addEventListener('click', () => {

    const isOpen = addOptional.classList.contains('hidden');

    addOptional.classList.toggle('hidden');

    if (isOpen) {
        // sada je otvoreno
        addToggleBtn.textContent = `${t('toggleHide')}`;
    } else {
        // sada je zatvoreno
        addToggleBtn.textContent = `${t('toggleMore')}`;
    }

});



// ===== EDIT MODAL =====
const editBtn           = document.querySelector('.btn-edit');
const editModal = document.querySelector('.edit-modal');

const editSaveBtn = document.getElementById('edit-save');
const editCancelBtn = document.getElementById('edit-cancel');

const editToggleBtn = document.getElementById('edit-toggle-more');
const editOptional = document.getElementById('edit-optional-fields');

const editLocationSelector = document.getElementById('edit-location-selector');

let editActiveLocationStep =
    'warehouse';

let editItem = null;

let editLocationState = {
    warehouse: null,
    zone: null,
    rack: null,
    shelf: null
};

// Redenreovanje Location segemnta
function renderEditLocationSelector() {

    editLocationSelector.innerHTML = '';

    const grid =
        document.createElement('div');

    grid.className =
        'location-option-grid';

    let options = [];

    switch (editActiveLocationStep) {

        case 'warehouse':

            options = Array.from(
                { length: 10 },
                (_, i) => `W${i + 1}`
            );

            break;

        case 'zone':

            options = [
                'A','B','C',
                'D','E','F',
                'G','H'
            ];

            break;

        case 'rack':

            options = Array.from(
                { length: 20 },
                (_, i) =>
                    String(i + 1)
                        .padStart(2, '0')
            );

            break;

        case 'shelf':

            options = [
                '1','2','3',
                '4','5','6'
            ];

            break;
    }

    options.forEach(value => {

        const btn =
            document.createElement('button');

        btn.type = 'button';
        btn.className = 'location-option';
        btn.textContent = value;

        if (
            editLocationState[
                editActiveLocationStep
            ] === value
        ) {
            btn.classList.add('selected');
        }

        btn.addEventListener('click', () => {

            editLocationState[
                editActiveLocationStep
            ] = value;

            document
                .querySelector(
                    `[data-edit-step="${editActiveLocationStep}"] .segment-value`
                )
                .textContent = value;

            const nextStep = {
                warehouse: 'zone',
                zone: 'rack',
                rack: 'shelf'
            };

            const next =
                nextStep[
                    editActiveLocationStep
                ];

            if (next) {

                document
                    .querySelectorAll(
                        '[data-edit-step]'
                    )
                    .forEach(btn =>
                        btn.classList.remove('active')
                    );

                editActiveLocationStep =
                    next;

                document
                    .querySelector(
                        `[data-edit-step="${next}"]`
                    )
                    .classList.add('active');

                updateEditLocationInfo();
            }

            renderEditLocationSelector();
        });

        grid.appendChild(btn);
    });

    editLocationSelector.appendChild(grid);
}

function updateEditLocationInfo() {

    const title =
        document.getElementById(
            'edit-location-step-title'
        );

    const desc =
        document.getElementById(
            'edit-location-step-desc'
        );

    switch (editActiveLocationStep) {

        case 'warehouse':

            title.textContent =
                'Warehouse';

            desc.textContent =
                'Select warehouse location';

            break;

        case 'zone':

            title.textContent =
                'Zona';

            desc.textContent =
                'Odaberi zonu u skladištu';

            break;

        case 'rack':

            title.textContent =
                'Regala';

            desc.textContent =
                'Broj regale u zoni';

            break;

        case 'shelf':

            title.textContent =
                'Polica';

            desc.textContent =
                'Nivo police';

            break;
    }

}
document
    .querySelectorAll('[data-edit-step]')
    .forEach(segment => {

        segment.addEventListener('click', () => {

            document
                .querySelectorAll('[data-edit-step]')
                .forEach(btn =>
                    btn.classList.remove('active')
                );

            segment.classList.add('active');

            editActiveLocationStep =
                segment.dataset.editStep;

            updateEditLocationInfo();
            renderEditLocationSelector();
        });

    });


// TOGGLE
editToggleBtn.addEventListener('click', () => {

    const isOpen = editOptional.classList.contains('hidden');

    editOptional.classList.toggle('hidden');

    if (isOpen) {
        editToggleBtn.textContent = `${t('toggleHide')}`;
    } else {
        editToggleBtn.textContent = `${t('toggleMore')}`;
    }

});


// OPEN EDIT
editBtn.addEventListener('click', () => {

    if (!selectedItem) {
        showNotification(`❌ ${t('noItemSelected')}`, 'error');
        return;
    }

    editItem = selectedItem;

    document.getElementById('edit-name').value = selectedItem.name;
    document.getElementById('edit-price').value = selectedItem.price;
    document.getElementById('edit-limit').value = selectedItem.limit;
    document.getElementById('edit-code').value = selectedItem.code;
    document.getElementById('edit-status').value = selectedItem.status;

    
  
    // LOcation segment
    const [warehouse, zone, rack, shelf] = (selectedItem.location || '').split('-');

    editLocationState = {
        warehouse: warehouse || null,
        zone: zone || null,
        rack: rack || null,
        shelf: shelf || null
    };


    refreshEditLocationSegments();
    renderEditLocationSelector();


    editModal.classList.remove('hidden');
});


function refreshEditLocationSegments() {

    document.querySelector('[data-edit-step="warehouse"] .segment-value').textContent = editLocationState.warehouse || '-';
    document.querySelector('[data-edit-step="zone"] .segment-value').textContent = editLocationState.zone || '-';
    document.querySelector('[data-edit-step="rack"] .segment-value').textContent = editLocationState.rack || '-';
    document.querySelector('[data-edit-step="shelf"] .segment-value').textContent =editLocationState.shelf || '-';
}

// SAVE → IDE DIREKTNO U DB 
editSaveBtn.addEventListener('click', async () => {

    const name = document.getElementById('edit-name').value.trim();
    const code = document.getElementById('edit-code').value.trim();
    const status = document.getElementById('edit-status').value.trim();
    const price = Number(document.getElementById('edit-price').value);
    const limit = Number(document.getElementById('edit-limit').value);
    const location =`${editLocationState.warehouse}-${editLocationState.zone}-${editLocationState.rack}-${editLocationState.shelf}`;

    // Vlaidacija Location
        if (
        !editLocationState.warehouse ||
        !editLocationState.zone ||
        !editLocationState.rack ||
        !editLocationState.shelf
    ) {
        showNotification(`❌ ${t('invalidInput')}`, 'error');
        return;
    }

    // Vlaidacija  ostalog
    if (!name || isNaN(price) || isNaN(limit)) {
        showNotification(`❌ ${t('invalidInput')}`, 'error')
        return;
    }

    // LOGOVI
    if (editItem.name !== name)         await addLog(editItem.id, 'name', editItem.name, name);
    if (editItem.code !== code)         await addLog(editItem.id, 'code', editItem.code, code);
    if (editItem.location !== location) await addLog(editItem.id, 'location', editItem.location, location);
    if (editItem.status !== status)     await addLog(editItem.id, 'status', editItem.status, status);
    if (editItem.price !== price)       await addLog(editItem.id, 'price', editItem.price, price);
    if (editItem.limit !== limit)       await addLog(editItem.id, 'limit', editItem.limit, limit);

    const { error } = await supabaseClient
        .from('items')
        .update({ name, code, status, location, price, limit })
        .eq('id', editItem.id);

    if (error) {
        showNotification(error.message, 'error');
        return;
    }

    showNotification(`✔ ${t('updatedSuccess')}`, 'success');

    await fetchItems();

    //  KLJUČNO — update UI kartice
    selectedItem = items.find(i => i.id === editItem.id);
    if (selectedItem) selectItem(selectedItem);

    editModal.classList.add('hidden');
    editItem = null;
});


// CANCEL
editCancelBtn.addEventListener('click', () => {
    editModal.classList.add('hidden');
    editItem = null;
});





// --------------------------------------------------------- TEST ----------------------------------------------------


















// -------------------- FEATURE: ARCHIVE-BTN --------------------
//1.  SELECTORS ===
const archiveItemBtn     = document.querySelector('.btn-archive');
const archiveModal       = document.querySelector('.archive-modal');
const confirmArchiveBtn  = document.querySelector('.btn-confirm-archive');
const cancelArchiveBtn   = document.querySelector('.btn-cancel-archive');

//3.  FUNCTIONS ===
function openArchiveModal() {
    archiveModal.classList.remove('hidden');
}

function closeArchiveModal() {
    archiveModal.classList.add('hidden');
}

//4.  EVENTS ===
archiveItemBtn.addEventListener('click', function(){
    if(!selectedItem){
        showNotification(`❌ ${t('noItemSelected')}`, 'error')
        return;
    } 

     // Otvori confirmation modal
    openArchiveModal();
})
cancelArchiveBtn.addEventListener('click', function(){
    closeArchiveModal();
})
confirmArchiveBtn.addEventListener('click', async function () {

    if (!selectedItem) return;

    const itemId = selectedItem.id;

    // 1. ARCHIVE ITEM (umesto potpunog brisna sada Arhiviramo)
    const { error } = await supabaseClient
        .from('items')
        .update({ is_active: false })
        .eq('id', itemId);

    if (error) {
        console.error(error);
        showNotification(`❌ ${error.message}`, 'error');
        return;
    }

    showNotification(`✔ ${t('archiveInfo')}`, 'success')

    // refresh UI
    await fetchItems();

    selectedItem = null;
    resetDisplay();

    closeArchiveModal()
});

// -------------------- FEATURE: TOGGLE MORE --------------------
//1.  SELECTORS ===
const toggleMoreBtn = document.getElementById('toggle-more');
const optionalFields = document.getElementById('optional-fields');




// ========================================================== INVENTORY CARDS ==========================================================

// -------------------- FEATURE: TABLE VIEW --------------------
//1.  SELECTORS ===
const tableWrapper = document.querySelector('.table-wrapper');
const inventoryList = document.querySelector('.inventory-list');

// INVENTORY HEADER

const inventorySearch       = document.getElementById('inventory-search');
const inventoryTotalCount   = document.getElementById('inventory-total-count');
const criticalPill          = document.querySelector('.summary-pill.critical .pill-value');
const lowPill               = document.querySelector('.summary-pill.low .pill-value');
const okPill                = document.querySelector('.summary-pill.ok .pill-value');
const excessPill            = document.querySelector('.summary-pill.excess .pill-value');

let inventorySearchTerm = '';

function updateInventoryStats() {

    if (!items) return;

    let critical = 0;
    let low = 0;
    let ok = 0;
    let empty = 0;

    items.forEach(item => {

        const status =
            getStockStatus(item);

        switch (status) {

            case 'empty':

                empty++;

                break;

            case 'critical':

                critical++;

                break;

            case 'low':

                low++;

                break;

            case 'ok':

                ok++;

                break;
        }

    });

    inventoryTotalCount.textContent =
        items.length;

    criticalPill.textContent =
        critical;

    lowPill.textContent =
        low;

    okPill.textContent =
        ok;

    excessPill.textContent =
        empty;
}

// SEARCH F
function getFilteredInventoryItems() {

    let filtered = [...items];

    if (inventorySearchTerm.trim()) {

        const search =
            inventorySearchTerm.toLowerCase();

        filtered = filtered.filter(item => {

            return (

                item.name
                    ?.toLowerCase()
                    .includes(search)

                ||

                item.code
                    ?.toLowerCase()
                    .includes(search)

                ||

                item.location
                    ?.toLowerCase()
                    .includes(search)

            );

        });

    }

    return filtered;
}

function getStockStatus(item) {

    const qty =
        Number(item.quantity || 0);

    const limit =
        Number(item.limit || 0);

    if (qty === 0) {

        return 'empty';
    }

    if (qty < limit) {

        return 'critical';
    }

    if (qty <= limit * 1.2) {

        return 'low';
    }

    return 'ok';
}
//Search EVENt
inventorySearch.addEventListener('input', function () {

    inventorySearchTerm = this.value;

    inventoryPagination.currentPage = 1;

    renderInventoryTable();

});





//3.  FUNCTIONS ===



// Render Inventory Table
function renderInventoryTable() {

    inventoryList.innerHTML = '';

    const filteredItems =
        getFilteredInventoryItems();

    const totalPages =
        Math.ceil(
            filteredItems.length /
            inventoryPagination.itemsPerPage
        ) || 1;

    const pageItems = paginate(
        filteredItems,
        inventoryPagination.currentPage,
        inventoryPagination.itemsPerPage
    );

    if (pageItems.length === 0) {

        inventoryList.innerHTML = `
            <div class="inventory-empty">
                ${t('noItems')}
            </div>
        `;

    } else {

        pageItems.forEach(item => {

            const card = document.createElement('div');

            card.classList.add('inventory-card');
let stockIndicator = '';

const status = getStockStatus(item);

switch (status) {

    case 'empty':

        stockIndicator = `
            <div class="stock-indicator stock-empty">
                <div class="stock-icon">
                    <svg
                        class="stock-svg danger-icon"
                        viewBox="0 0 24 24">

                        <path
                            fill="currentColor"
                            d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/>
                    </svg>
                </div>
            </div>
        `;

        break;

    case 'critical':

        stockIndicator = `
            <div class="stock-indicator stock-critical">
                <div class="stock-icon">
                    <svg
                        class="stock-svg warning-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2L1 21h22L12 2zm0 5l1 8h-2l1-8zm0 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                    </svg>
                </div>
            </div>
        `;

        break;

    case 'low':

        stockIndicator = `
            <div class="stock-indicator stock-low">
                <div class="stock-bars">
                    <span class="filled"></span>
                    <span class="filled"></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        break;

    case 'ok':

        stockIndicator = `
            <div class="stock-indicator stock-good">
                <div class="stock-bars">
                    <span class="filled"></span>
                    <span class="filled"></span>
                    <span class="filled"></span>
                    <span class="filled"></span>
                </div>
            </div>
        `;

        break;
}

            card.innerHTML = `
                <div class="inventory-left">
                    <div class="inventory-name">
                        ${item.name}
                    </div>

                    <div class="inventory-meta">
                        ${item.code || '-'} • ${item.location || '-'}
                    </div>

                </div>

                <div class="inventory-right">

                    <div class="inventory-qty">
                        ${item.quantity}
                    </div>

                    ${stockIndicator}

                </div>

            `;

            card.addEventListener('click', function () {

                selectItem(item);

                goToInputTab();

            });

            inventoryList.appendChild(card);

        });

    }

    pageinfo.textContent =
        `Page ${inventoryPagination.currentPage} / ${totalPages}`;

    prevBtn.disabled =
        inventoryPagination.currentPage === 1;

    nextBtn.disabled =
        inventoryPagination.currentPage === totalPages;
}

function goToInputTab() {

    document
        .querySelector(`[data-tab="${TAB.ITEM}"]`)
        .click();

    clearBtn.style.display = 'block';
}

// -------------------- FEATURE: PAGINATION --------------------
//1.  SELECTORS ===
const prevBtn           = document.querySelector('.prev-btn');
const nextBtn           = document.querySelector('.next-btn');
const pageinfo          = document.querySelector('.page-info');

const inventoryPagination = {
    currentPage: 1,
    itemsPerPage: 10
};


//3.  FUNCTIONS ===
function setupInventoryPagination() {

    prevBtn.addEventListener('click', function () {

        if (inventoryPagination.currentPage > 1) {

            inventoryPagination.currentPage--;

            renderInventoryTable();
        }
    });

    nextBtn.addEventListener('click', function () {

        const totalPages =
            Math.ceil(
                items.length /
                inventoryPagination.itemsPerPage
            );

        if (inventoryPagination.currentPage < totalPages) {

            inventoryPagination.currentPage++;

            renderInventoryTable();
        }
    });
}
// Generička funkcija za pagination
function paginate(data, currentPage, itemsPerPage) {

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    return data.slice(start, end);
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
        return sum + (Number(item.price) * Number(item.quantity));
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
            `<tr><td colspan="4" data-i18n="NoLowStockItems">${t('NoLowStockItems')}</td></tr>`;
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








// ========================================================== TRANSACTION ==========================================================
// -------------------- FEATURE: TRANSACTIONS --------------------

// BUTTONS
const btnReceive        = document.getElementById('btn-receive');
const btnIssue          = document.getElementById('btn-issue');

const pdfToggle         = document.getElementById('pdf-toggle');


// MODAL
const transactionModal  = document.querySelector('.transaction-modal');
const transactionTitle  = document.getElementById('transaction-title');
const transactionCancel = document.getElementById('transaction-cancel');
const transactionConfirm= document.getElementById('transaction-confirm');

// SEARCH
const transactionSearch  = document.getElementById('transaction-search');
const transactionResults= document.querySelector('.transaction-results');

// LISTA
const transactionList = document.querySelector('.transaction-modal .transaction-list');


//STATE
let transactionMode = null;
let transactionItems = []; 
let isCopyMode = false;
let copiedItemData = null;

let selectedCompany   = null;
let selectedPartner     = null;

//OTVARANJE MODULA

btnReceive.addEventListener('click', () => {
    transactionMode = 'receipt';
    transactionTitle.textContent = t('txNewReceipt'); 
    openTransactionModal();
})

btnIssue.addEventListener('click', () => {
    transactionMode = 'issue';
    transactionTitle.textContent = t('txNewIssue'); 
    openTransactionModal();
});


async function openTransactionModal() {

    transactionItems = [];
    transactionList.innerHTML = '';
    transactionSearch.value = '';
    transactionResults.innerHTML = '';

    // UCITAJ PODATKE u PADJUCI MENI
    await fetchCompanies();
    await fetchPartners();
    populateDropdowns();

    // reset
    selectedCompany = null;
    selectedPartner = null;

    document.getElementById('tx-company').value = '';
    document.getElementById('tx-partner').value = '';

    pdfToggle.checked = false;


    transactionModal.classList.remove('hidden');
    transactionSearch.focus();
}
// ZATVARANJE MOUDLA
transactionCancel.addEventListener('click', () => {
    transactionModal.classList.add('hidden');
});



// SEARCH 
transactionSearch.addEventListener('input', function () {

    const value = this.value.trim().toLowerCase();

    if (value === '') {
        transactionResults.innerHTML = '';
        return;
    }

    const filtered = items.filter(item => {

        const matchesSearch =
            item.name.toLowerCase().includes(value) ||
            String(item.code).includes(value);

        const alreadySelected = transactionItems.some(ti =>
            !ti.isNew && ti.id === item.id
        );

        return matchesSearch && !alreadySelected;
    });

    renderTransactionResults(filtered);
});

//PRIKAZ REZULTATA PRETRAGE
function renderTransactionResults(results) {

    transactionResults.innerHTML = '';

    if (results.length === 0) {

        const div = document.createElement('div');
        div.classList.add('no-results');

        const text = document.createElement('p');
        text.textContent = t('noResults');

        div.appendChild(text);

        //  samo za RECEIPT
        if (transactionMode === 'receipt') {

            const button = document.createElement('button');
            button.classList.add('add-new-btn');
            button.textContent = t('addNewItem');

        button.addEventListener('click', () => {

            //  očisti search UI
            transactionSearch.value = '';
            transactionResults.innerHTML = '';

            // OVO JE KLJUČ
            // fromTransaction = true;              // kaže sistemu odakle dolazimo
            modal.classList.add('child-modal'); // ide iznad transaction moda
            modal.classList.remove('hidden');

            addName.focus();
        });

            div.appendChild(button);
        }

        transactionResults.appendChild(div);
        return;
    }

    results.forEach(item => {

        const div = document.createElement('div');
        div.classList.add('result-item');

        div.textContent = `${item.name} (${item.code}) - ${item.status}`;

        div.addEventListener('click', () => {
            addToTransaction(item);
            transactionResults.innerHTML = '';  // zatvori Results
            transactionSearch.value = '';       //Obrisi Search
        });

        transactionResults.appendChild(div);
    });
}

// Proverava da li item već postoji → ako ne postoji, dodaje ga u listu i renderuje UI
function addToTransaction(item) {

    const exists = transactionItems.find(i =>
        !i.isNew && i.id === item.id
    );


  if (exists) {
        showNotification(`ℹ ${t('itemExists')}`, 'info');
        return;
    }


transactionItems.push({
    id: item.id || 'tmp_' + Date.now(),
    name: item.name,
    code: item.code || '',
    status: item.status || '',
    location: item.location || '',
    warehouse_code:item.warehouse_code || '',
    zone_code:item.zone_code || '',
    rack_code:item.rack_code || '',
    shelf_code:item.shelf_code || '',
    price: item.price || 0,
    limit: item.limit || 0,
    isNew: item.isNew || false,
    qty: item.qty || ''
});

    renderTransactionList();
}
// KREIRAMO TRANSACTION LISTU
function renderTransactionList() {

    transactionList.innerHTML = '';

    transactionItems.forEach(item => {

        const div = document.createElement('div');
        div.classList.add('transaction-item');

        const current = items.find(i => i.id === item.id);
        const stock = current ? current.quantity : 0;

        div.innerHTML = `
            <div class="ti-left">
                <span class="ti-name">${item.name}</span>
                <span class="ti-stock">${stock} pcs</span>
            </div>

            <div class="ti-middle">
                <input class="ti-input" type="number" value="${item.qty}" min="1">
            </div>


            <div class="ti-actions">

                ${transactionMode === 'receipt' ? `
                <button class="ti-copy">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm4 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h12v14z"/>
                    </svg>
                </button>
                ` : ''}

                <button class="ti-delete">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor"
                        d="M9 3h6l1 1h4v2H4V4h4l1-1zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 9h2v9H6V9z"/>
                    </svg>
                </button>

            </div>
        `;

        const input = div.querySelector('input');
        input.addEventListener('change', () => {
            let value = Number(input.value);

            if (value < 1) value = 1;

            item.qty = value;
            input.value = value;
        });

        const deleteBtn = div.querySelector('.ti-delete');

        deleteBtn.addEventListener('click', () => {

            openConfirm({
                text: t('removeItemQuestion'),
                onConfirm: () => {
                    transactionItems = transactionItems.filter(i => i.id !== item.id);
                    renderTransactionList();
                }
            });

        });

        
        //  COPY (OVDE TREBA!)
        const copyBtn = div.querySelector('.ti-copy');

        if (copyBtn) {      // mora ovde porevra jer u Otpremnici ne zlimo da se prikzae COPY dugme
            copyBtn.addEventListener('click', () => {
                openCopyModal(item);
            });
        }


        transactionList.appendChild(div);
    });
}


// CONFIRM btn
transactionConfirm.addEventListener('click', async function () {

    //  1. VALIDACIJA – PRAZAN QTY
    const invalidItem = transactionItems.find(function(item) {

        if (!item.qty) return true;

        if (Number(item.qty) <= 0) return true;

        return false;
    });

    if (invalidItem) {
        showNotification(`❌ ${t('enterQty')} [${invalidItem.name}]`, 'error');
        return;
    }

    // 2. VALIDACIJA – NEMA ITEMA
    if (transactionItems.length === 0) {
        showNotification(`❌ ${t('noItemsTx')}`, 'error');
        return;
    }

    // OBAVEZAN ODABIR ZA SVAKU TRANSAKCIJU
    if (!selectedCompany) {
        showNotification(`❌ ${t('selectCompany')}`, 'error');
        return;
    }

    if (!selectedPartner) {
        showNotification(`❌ ${t('selectPartner')}`, 'error');
        return;
    }


    
    // 3. VALIDACIJA – ISSUE (stock check)
    if (transactionMode === 'issue') {

        const problemItem = transactionItems.find(function(item) {

            const current = items.find(function(i) {
                return i.id === item.id;
            });

            if (!current) return false;

            if (current.quantity <= 0) {
                showNotification(`❌ ${item.name} ${t('outOfStock')}`, 'error');
                return true;
            }

            if (item.qty > current.quantity) {
                showNotification(`❌ ${t('notEnoughStock')} ${item.name}`, 'error');
                return true;
            }

            return false;
        });

        if (problemItem) return;
    }




    // CREATE TRANSACTION (centralized)
    // await createTransaction(transactionItems, transactionMode);
    const tx = await createTransaction(transactionItems, transactionMode);
    if (pdfToggle.checked) {
    generatePDF(tx, transactionItems);
}

   
    // not. 
    showNotification(`✔ ${t('txSuccess')}`, 'success');

    transactionModal.classList.add('hidden'); // zatvori modal

    await fetchItems();
    await fetchTransactions(); // pa refresh
});

// COPY funstion
function openCopyModal(item) {

    //Validacija - Ako nije Prijem modul
    if (transactionMode !== 'receipt') {
        showNotification(`❌ ${t('notAllowed')}`, 'error');
        return;
    }


    isCopyMode = true;
    copiedItemData = item;

    modal.classList.remove('hidden');
    addName.value = item.name + ' copy';
    addCode.value = item.code || '';
    addStatus.value = item.status || '';
    addPrice.value = item.price || '';
    addLimit.value = item.limit || '';
    addQty.value = '';

    addOptional.classList.remove('hidden');
}


async function createTransaction(itemsList, type) {

    try {

        // =====================================================
        // 1. CREATE NEW ITEMS (SEQUENTIAL - REQUIRED)
        // =====================================================
        for (const item of itemsList) {

            if (!item.isNew) continue;

            const { data, error } = await supabaseClient
                .from('items')
                .insert([{
                    name: item.name,
                    code: item.code,
                    status: item.status,
                    location: item.location,
                    warehouse_code:item.warehouse_code,
                    zone_code:item.zone_code,
                    rack_code:item.rack_code,
                    shelf_code:item.shelf_code,
                    quantity: 0,
                    price: item.price,
                    limit: item.limit,
                    user_id: currentUser.id,
                    is_active: true
                }])
                .select()
                .single();

            if (error || !data) {
                showNotification(`❌ ${t('errCreateItem')} ${item.name}`, 'error');
                throw new Error('Create item failed');
            }

            item.id = data.id;
            item.isNew = false;

            await addLog(item.id, 'created', '', item.name);
        }


        // =====================================================
        // 2. CREATE TRANSACTION
        // =====================================================
        const { data: tx, error: txError } = await supabaseClient
            .from('transactions')
            .insert([{
                type: type,
                user_id: currentUser.id,
                company_id: selectedCompany,
                partner_id: selectedPartner
            }])
            .select()
            .single();

        if (txError || !tx) {
            showNotification(`❌ ${t('errCreateTx')}`, 'error');
            throw new Error('Create transaction failed');
        }


        // =====================================================
        // 3. PROCESS ITEMS (PARALLEL + SAFE)
        // =====================================================
        const operations = itemsList.map(async (item) => {

            // 1. INSERT transaction item
            const { error: txItemError } = await supabaseClient
                .from('transaction_items')
                .insert({
                    transaction_id: tx.id,
                    item_id: item.id,
                    quantity: item.qty
                });

            if (txItemError) throw txItemError;


            // 2. ATOMIC UPDATE (KLJUČNO)
            const qtyChange = type === 'receipt'
                ? item.qty
                : -item.qty;

            const { error: updateError } = await supabaseClient.rpc('increment_quantity', {
                item_id_param: item.id,
                qty_change_param: qtyChange
            });

            if (updateError) throw updateError;


            // 3. LOG
            const { data: dbItem } = await supabaseClient
                .from('items')
                .select('quantity')
                .eq('id', item.id)
                .single();

            const newQty = dbItem.quantity;
            const oldQty = newQty - qtyChange;
            await addLog(item.id, 'quantity', oldQty, newQty, tx.id);
        });

        await Promise.all(operations);


        return tx;

    } catch (err) {

        console.error('TRANSACTION ERROR:', err);
        showNotification(`❌ ${t('errCreateTx')}`, 'error');

        throw err;
    }
}








// -------------------- FEATURE: TRANSACTION TABLE --------------------
const transactionsContainer = document.querySelector('.transactions-list');
const transactionsBody = document.querySelector('.transactions-body');




async function fetchTransactions() {

    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
        

    if (error) {
        console.error(error);
        return;
    }

    transactions = data;
    renderTransactionsTable();
}


function renderTransactionsTable() {

    transactionsBody.innerHTML = '';

    const totalPages =
        Math.ceil(
            transactions.length /
            transactionPagination.itemsPerPage
        ) || 1;

    const pageTransactions = paginate(
        transactions,
        transactionPagination.currentPage,
        transactionPagination.itemsPerPage
    );

    if (!transactions || transactions.length === 0) {

        transactionsBody.innerHTML =
            `<tr><td colspan="4" data-i18n="NoTransactions">${t('NoTransactions')}</td></tr>`;

        txPageInfo.textContent = `Page 1 / 1`;

        txPrevBtn.disabled = true;
        txNextBtn.disabled = true;

        return;
    }

    pageTransactions.forEach(tx => {

        const tr = document.createElement('tr');

        const txId = tx.id;

        const type =
            tx.type === 'receipt'
                ? t('receiveBtn')
                : t('issueBtn');

        const date = new Date(tx.created_at).toLocaleString('sr-RS', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        tr.innerHTML = `
            <td>#${txId}</td>
            <td>${type}</td>
            <td>${date}</td>
            <td class="col-action">

                <button class="btn-pdf" title="Generate PDF" data-id="${tx.id}">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor"
                        d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 13h2.5a2.5 2.5 0 0 0 0-5H8v5zm2-1.5H9v-2h1a1 1 0 1 1 0 2zm1 1.5h1.5c1.8 0 3-1.2 3-3s-1.2-3-3-3H11v6zm1.5-1.5H12v-3h.5c1 0 1.5.7 1.5 1.5s-.5 1.5-1.5 1.5z"/>
                    </svg>
                </button>

            </td>
        `;

        const pdfBtn = tr.querySelector('.btn-pdf');

        pdfBtn.addEventListener('click', async (e) => {

            e.stopPropagation();

            try {

                const { data: items, error } = await supabaseClient
                    .from('transaction_items')
                    .select(`
                        quantity,
                        items (
                            name,
                            code,
                            status,
                            price
                        )
                    `)
                    .eq('transaction_id', tx.id);

                if (error) {
                    console.error(error);
                    showNotification(t('pdfLoadError'), 'error');
                    return;
                }

                const itemsList = items.map(row => ({
                    name: row.items.name,
                    code: row.items.code,
                    status: row.items.status,
                    price: row.items.price,
                    qty: row.quantity
                }));

                await fetchCompanies();
                await fetchPartners();

                selectedCompany = tx.company_id;
                selectedPartner = tx.partner_id;

                generatePDF(tx, itemsList);

            } catch (err) {

                console.error(err);
                showNotification(`❌ ${t('pdfGenerationFailed')}`, "error");

            }

        });

        transactionsBody.appendChild(tr);
    });

    txPageInfo.textContent =
        `Page ${transactionPagination.currentPage} / ${totalPages}`;

    txPrevBtn.disabled =
        transactionPagination.currentPage === 1;

    txNextBtn.disabled =
        transactionPagination.currentPage === totalPages;
}


// ---------  TRASACTION - PAGINATION -----------------
// tx-Pagination
const txPrevBtn = document.querySelector('.tx-prev-btn');
const txNextBtn = document.querySelector('.tx-next-btn');
const txPageInfo = document.querySelector('.tx-page-info');

const transactionPagination = {
    currentPage: 1,
    itemsPerPage: 10
};

function setupTransactionPagination() {

    txPrevBtn.addEventListener('click', function () {

        if (transactionPagination.currentPage > 1) {

            transactionPagination.currentPage--;

            renderTransactionsTable();
        }
    });

    txNextBtn.addEventListener('click', function () {

        const totalPages =
            Math.ceil(
                transactions.length /
                transactionPagination.itemsPerPage
            );

        if (transactionPagination.currentPage < totalPages) {

            transactionPagination.currentPage++;

            renderTransactionsTable();
        }
    });
}

// -------------------------------------- PDF REPORT --------------------------------------


//  POPUNJAVNJE PADAJUCIH MENIJA
function populateDropdowns() {

    const cyhSelect = document.getElementById('tx-company');
    const ptSelect = document.getElementById('tx-partner');

    // reset
    cyhSelect.innerHTML = `<option value="">${t("selectCompany")}</option>`;
    ptSelect.innerHTML = `<option value="">${t("selectPartner")}</option>`;

    companies.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name;
        cyhSelect.appendChild(opt);
    });

    partners.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        ptSelect.appendChild(opt);
    });
}

// EVENTOVI
document.getElementById('tx-company').addEventListener('change', (e) => {
    selectedCompany = e.target.value;
});

document.getElementById('tx-partner').addEventListener('change', (e) => {
    selectedPartner = e.target.value;
});

// -------------------- GENERISANJE PDF IZVESATJA --------------------
function generatePDF(tx, itemsList) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const company = companies.find(w => w.id == selectedCompany);
    const partner = partners.find(p => p.id == selectedPartner);

    const setBold = () => doc.setFont(undefined, "bold");
    const setNormal = () => doc.setFont(undefined, "normal");

    let y = 20;

    // ===============================
    // HEADER
    // ===============================
    setBold();
    doc.setFontSize(22);
    doc.text(t("invoice"), 150, y);

    doc.setDrawColor(0, 102, 153);
    doc.line(10, y + 5, 200, y + 5);

    y += 15;

    // ===============================
    // FROM / BILL TO
    // ===============================
    setBold();
    doc.setFontSize(11);

    doc.text(t("from"), 10, y);
    doc.text(t("billTo"), 110, y);

    setNormal();
    doc.setFontSize(9);

    doc.text(company?.name || "-", 10, y + 6);
    doc.text(company?.address || "-", 10, y + 12);
    doc.text(`${t("email")}: ${company?.email || "-"}`, 10, y + 18);
    doc.text(`${t("pib")}: ${company?.pib || "-"}`, 10, y + 24);

    doc.text(partner?.name || "-", 110, y + 6);
    doc.text(partner?.address || "-", 110, y + 12);
    doc.text(`${t("email")}: ${partner?.email || "-"}`, 110, y + 18);
    doc.text(`${t("pib")}: ${partner?.pib || "-"}`, 110, y + 24);

    y += 35;

    // ===============================
    // TRANSACTION
    // ===============================
    setBold();
    doc.setFontSize(12);

    doc.text(`${t("transaction")} #${tx.id}`, 10, y);

    if (tx.type === "receipt") {
        doc.setTextColor(0, 130, 0);
        doc.text(t("receipt"), 150, y);
    } else {
        doc.setTextColor(180, 0, 0);
        doc.text(t("issue"), 150, y);
    }

    doc.setTextColor(0);
    doc.line(10, y + 3, 200, y + 3);

    y += 12;

    // ===============================
    // TABLE HEADER  (manji font)
    // ===============================
    doc.setFillColor(0, 70, 120);
    doc.rect(10, y, 190, 8, "F");

    setBold();
    doc.setTextColor(255);
    doc.setFontSize(9); //  smanjeno

    doc.text(t("colName"), 12, y + 5);
    doc.text(t("colCode"), 65, y + 5);
    doc.text(t("colQuantity"), 105, y + 5);
    doc.text(t("colStatus"), 125, y + 5);
    doc.text(t("colPrice"), 160, y + 5, { align: "right" });
    doc.text(t("colTotal"), 195, y + 5, { align: "right" });

    doc.setTextColor(0);
    y += 10;

    // ===============================
    // ITEMS  (manji font)
    // ===============================
    setNormal();
    doc.setFontSize(9); //  smanjeno

    let grandTotal = 0;

    itemsList.forEach((item, index) => {
        const total = (item.qty || 0) * (item.price || 0);
        grandTotal += total;

        if (index % 2 === 0) {
            doc.setFillColor(245);
            doc.rect(10, y - 2, 190, 8, "F");
        }

        doc.text(item.name || "-", 12, y + 3);
        doc.text(item.code || "-", 65, y + 3);
        doc.text(String(item.qty ?? 0), 105, y + 3);
        doc.text(item.status || "-", 125, y + 3);

        doc.text(`${item.price ?? 0} €`, 160, y + 3, { align: "right" });
        doc.text(`${total} €`, 195, y + 3, { align: "right" });

        y += 8;

        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    });

    // ===============================
    // TOTAL
    // ===============================
    y += 10;

    const vatPercent = company?.vat || 0;
    const vatRate = vatPercent / 100;

    const vatAmount = grandTotal * vatRate;
    const finalTotal = grandTotal + vatAmount;

    setNormal();
    doc.setFontSize(10);

    doc.text(`${t("subtotal")}: ${grandTotal.toFixed(2)} €`, 140, y);
    doc.text(`${t("vat")} (${vatPercent}%): ${vatAmount.toFixed(2)} €`, 140, y + 6);

    doc.setFillColor(230);
    doc.rect(120, y + 12, 80, 18, "F");

    setBold();
    doc.setFontSize(12);
    doc.text(t("total"), 125, y + 20);

    doc.setFontSize(14);
    doc.text(`${finalTotal.toFixed(2)} €`, 195, y + 20, { align: "right" });

    // ======= FOOTER

    const pageHeight = doc.internal.pageSize.height;
    const startY = pageHeight - 35;

    doc.line(10, startY - 5, 200, startY - 5);

    const col1 = 10;
    const col2 = 70;
    const col3 = 130;

    setBold();
    doc.setFontSize(9);

    doc.text(t("ourCompany"), col1, startY);
    doc.text(t("contact"), col2, startY);
    doc.text(t("paymentDetails"), col3, startY);

    setNormal();
    doc.setFontSize(8);

    doc.text(company?.name || "-", col1, startY + 5);
    doc.text(company?.address || "-", col1, startY + 10);
    doc.text(`${t("mb")}: ${company?.mb || "-"}`, col1, startY + 15);

    doc.text(`${t("phone")}: ${company?.phone || "-"}`, col2, startY + 5);
    doc.text(`${t("email")}: ${company?.email || "-"}`, col2, startY + 10);
    doc.text(`${t("web")}: ${company?.website || "-"}`, col2, startY + 15);

    doc.text(`${t("bank")}: ${company?.bank || "-"}`, col3, startY + 5);
    doc.text(`IBAN: ${company?.iban || "-"}`, col3, startY + 10);
    doc.text(`SWIFT: ${company?.swift || "-"}`, col3, startY + 15);

    doc.save(`invoice_${tx.id}.pdf`);
}












// ========================================================== ARCHIVE ==========================================================

// ==========================================================
//  ARCHIVE
// ----------------------------------------------------------
// Šta radi:
// 1. Otvara Archive view iz sidebar-a
// 2. Uklanja active tab (jer nije tab screen)
// 3. Prikazuje samo obrisane iteme
// 4. Omogućava restore itema
// ==========================================================


//  SELEKTORI
const openArchiveBtn    = document.querySelector('.archive-btn');
const archiveView       = document.getElementById('archive-view');
const archiveBody       = document.querySelector('.archive-body');
const archiveEmpty      = document.querySelector('.archive-empty');



//  STATE
// SVI itemi (aktivni + arhivirani)
let itemsAll = [];


//  OPEN ARCHIVE VIEW
openArchiveBtn.addEventListener('click', async function() {

    if (!currentUser) return;

    //  1. ukloni active sa tabova (jer nismo u tabs flow-u)
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.classList.remove('active');
    });

    //  2. sakrij sve view-e
    document.querySelectorAll('.view').forEach(function(view) {
        view.classList.remove('active-view');
    });

    //  3. prikaži archive view
    archiveView.classList.add('active-view');

    //  4. uzmi sve iteme (aktivne + obrisane)
    await fetchAllItems();

    //  5. render
    renderArchiveItems();

    //  6. zatvori sidebar
    sidebar.classList.add('hidden');
});



//  FETCH ALL ITEMS
async function fetchAllItems() {

    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from('items')
        .select('*')
        .eq('user_id', currentUser.id);

    if (error) {
        console.error('FETCH ALL ERROR:', error);
        return;
    }

    itemsAll = data;
}



//  RENDER ARCHIVE ITEMS
function renderArchiveItems() {

    // reset
    archiveBody.innerHTML = '';

    // Filtriramo samo arhivirane
    const archived = itemsAll.filter(function(item) {
        return item.is_active === false;
    });

    const totalPages =
        Math.ceil(
            archived.length /
            archivePagination.itemsPerPage
        ) || 1;

    const pageArchived = paginate(
        archived,
        archivePagination.currentPage,
        archivePagination.itemsPerPage
    );

    // EMPTY STATE
    if (archived.length === 0) {

        archiveBody.innerHTML =
            `<tr><td colspan="5" data-i18n="NoArchivetems">${t('NoArchivetems')}</td></tr>`;

        arPageInfo.textContent = `Page 1 / 1`;

        arPrevBtn.disabled = true;
        arNextBtn.disabled = true;

        return;
    }

    // RENDER LIST
    pageArchived.forEach(function(item) {

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.code || '-'}</td>
            <td>${item.location || '-'}</td>
            <td>${item.quantity}</td>
            <td class="col-action">
                <button class="ti-restore" title="${t('restore')}">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor"
                        d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>
                    </svg>
                </button>
            </td>
        `;

        // RESTORE BUTTON
        const restoreBtn = tr.querySelector('.ti-restore');

        restoreBtn.addEventListener('click', async function() {

            const { error } = await supabaseClient
                .from('items')
                .update({ is_active: true })
                .eq('id', item.id);

            if (error) {
                console.error(error);
                showNotification(`❌ ${error.message}`, 'error');
                return;
            }

            showNotification(
                `✔ ${item.name} ${t('itemRestored')}`,
                'success'
            );

            // refresh podataka
            await fetchItems();
            await fetchAllItems();

            renderArchiveItems();
        });

        archiveBody.appendChild(tr);
    });

    arPageInfo.textContent =
        `Page ${archivePagination.currentPage} / ${totalPages}`;

    arPrevBtn.disabled =
        archivePagination.currentPage === 1;

    arNextBtn.disabled =
        archivePagination.currentPage === totalPages;
}


//--------------- ARCHIVE - PAGINATION --------------- 
const arPrevBtn = document.querySelector('.ar-prev-btn');
const arNextBtn = document.querySelector('.ar-next-btn');
const arPageInfo = document.querySelector('.ar-page-info');

const archivePagination = {
    currentPage: 1,
    itemsPerPage: 10
};

function setupArchivePagination() {

    arPrevBtn.addEventListener('click', function () {

        if (archivePagination.currentPage > 1) {

            archivePagination.currentPage--;

            renderArchiveItems();
        }
    });

    arNextBtn.addEventListener('click', function () {

        const archived = itemsAll.filter(function(item) {
            return item.is_active === false;
        });

        const totalPages =
            Math.ceil(
                archived.length /
                archivePagination.itemsPerPage
            );

        if (archivePagination.currentPage < totalPages) {

            archivePagination.currentPage++;

            renderArchiveItems();
        }
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


// PRIKAZ SADRAJA TABA
function activateTab(tabElement) {

    // prvo uzmi tabName
    const tabName = tabElement.dataset.tab;

    // Ako se izadje iz INPUT taba resetuj odabtani item
    if (tabName !== 'item') {
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


    // fallback iako se sve vec azurira putem
    if (tabName === TAB.INVENTORY) {
        renderInventoryTable();
    }

    if (tabName === TAB.TRANSACTION) {
        renderTransactionsTable(); 
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

// ------------- SETTINGS ---------------
const settingsBtn = document.getElementById('settings-btn');
const submenu = document.getElementById('settings-submenu');

settingsBtn.addEventListener('click', () => {
    submenu.classList.toggle('hidden');
});


document.getElementById('open-company').addEventListener('click', async () => {
    await fetchCompanies();
    sidebar.classList.add('hidden');
    showCustomView('company-view');
    renderCompanies();
});

document.getElementById('open-partners').addEventListener('click', async () => {
    await fetchPartners();
    sidebar.classList.add('hidden');
    showCustomView('partners-view');
    renderPartners();
});


function renderCompanies() {

    const container = document.getElementById('company-list');
    container.innerHTML = '';

    if (!companies || companies.length === 0) {
        container.innerHTML = `<p>${t("noCompany")}</p>`;
        return;
    }

    companies.forEach(w => {

        const div = document.createElement('div');
        div.classList.add('transaction-item');

        div.innerHTML = `
            <div class="ti-left">
                <span class="ti-name">${w.name}</span>
                <span class="ti-stock">${w.address || ''}</span>
            </div>

            <div class="ti-actions">

                <button class="ti-copy">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm4 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h12v14z"/>
                    </svg>
                </button>

                <button class="ti-delete">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor"
                        d="M9 3h6l1 1h4v2H4V4h4l1-1zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 9h2v9H6V9z"/>
                    </svg>
                </button>

            </div>
        `;

        //  DELETE
        const deleteBtn = div.querySelector('.ti-delete');

        deleteBtn.addEventListener('click', () => {

            openConfirm({
                text: t('removeItemQuestion'),
                onConfirm: async () => {

                    await supabaseClient
                        .from('companies')
                        .delete()
                        .eq('id', w.id);

                    await fetchCompanies();
                    renderCompanies();

                    showNotification(`✔ ${w.name} ${t('companyRemoved')}`, 'success');
                }
            });

        });

        //  COPY (prefill modal)
        const copyBtn = div.querySelector('.ti-copy');
        copyBtn.addEventListener('click', () => {

            document.getElementById('cy-name').value = w.name;
            document.getElementById('cy-address').value = w.address || '';
            document.getElementById('cy-email').value = w.email || '';
            document.getElementById('cy-phone').value = w.phone || '';
            document.getElementById('cy-website').value = w.website || '';
            document.getElementById('cy-pib').value = w.pib || '';
            document.getElementById('cy-mb').value = w.mb || '';
            document.getElementById('cy-bank').value = w.bank || '';
            document.getElementById('cy-iban').value = w.iban || '';
            document.getElementById('cy-swift').value = w.swift || '';

            whModal.classList.remove('hidden');
        });

        container.appendChild(div);
    });
}

function renderPartners() {

    const container = document.getElementById('partners-list');
    container.innerHTML = '';

    if (!partners || partners.length === 0) {
        container.innerHTML = `<p>${t("noPartners")}</p>`;
        return;
    }

    partners.forEach(p => {

        const div = document.createElement('div');
        div.classList.add('transaction-item');

        div.innerHTML = `
            <div class="ti-left">
                <span class="ti-name">${p.name}</span>
                <span class="ti-stock">${p.type}</span>
            </div>

            <div class="ti-actions">

                <button class="ti-copy">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm4 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h12v14z"/>
                    </svg>
                </button>

                <button class="ti-delete">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor"
                        d="M9 3h6l1 1h4v2H4V4h4l1-1zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 9h2v9H6V9z"/>
                    </svg>
                </button>

            </div>
        `;

        //  DELETE
        const deleteBtn = div.querySelector('.ti-delete');
        deleteBtn.addEventListener('click', () => {

            openConfirm({
                text: t('removeItemQuestion'),
                onConfirm: async () => {

                    await supabaseClient
                        .from('partners')
                        .delete()
                        .eq('id', p.id);

                    await fetchPartners();
                    renderPartners();

                    showNotification(`✔ ${p.name} ${t('partnerDeleted')}`, 'success');
                }
            });

        });

        //  COPY (prefill modal)
        const copyBtn = div.querySelector('.ti-copy');
        copyBtn.addEventListener('click', () => {

            document.getElementById('pt-name').value = p.name;
            document.getElementById('pt-address').value = p.address || '';
            document.getElementById('pt-email').value = p.email || '';
            document.getElementById('pt-phone').value = p.phone || '';
            document.getElementById('pt-website').value = p.website || '';
            document.getElementById('pt-type').value = p.type || 'supplier';           
            document.getElementById('pt-pib').value = p.pib || '';
            document.getElementById('pt-mb').value = p.mb || '';


            ptModal.classList.remove('hidden');
        });

        container.appendChild(div);
    });
}


function showCustomView(viewId) {

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active-view');
    });

    document.getElementById(viewId).classList.add('active-view');
}

// ------------------------------------ + ADD ------------------------------------


// Otvaranje forme
const whModal = document.querySelector('.company-modal');
const ptModal = document.querySelector('.partner-modal');

document.getElementById('add-company-btn').addEventListener('click', () => {
    whModal.classList.remove('hidden');
    resetCompanyForm();
});


document.getElementById('add-partner-btn').addEventListener('click', () => {
    ptModal.classList.remove('hidden');
      resetPartnerForm();
});

// ------------------------------------ SAVE ------------------------------------
document.getElementById('cy-save').addEventListener('click', async () => {

    const name = document.getElementById('cy-name').value.trim();
    if (!name) return;

    await supabaseClient.from('companies').insert({
        name,
        address: document.getElementById('cy-address').value,
        email: document.getElementById('cy-email').value,
        phone: document.getElementById('cy-phone').value,
        website: document.getElementById('cy-website').value,
        pib: document.getElementById('cy-pib').value,
        mb: document.getElementById('cy-mb').value,

        bank: document.getElementById('cy-bank').value,
        iban: document.getElementById('cy-iban').value,
        swift: document.getElementById('cy-swift').value,
        vat: parseFloat(document.getElementById('cy-vat').value || 0),

        user_id: currentUser.id
    });

    whModal.classList.add('hidden');

    resetCompanyForm();

    await fetchCompanies();
    renderCompanies();
});


document.getElementById('pt-save').addEventListener('click', async () => {

    const name = document.getElementById('pt-name').value.trim();
    if (!name) return;

    await supabaseClient.from('partners').insert({
        name,
        address: document.getElementById('pt-address').value,
        email: document.getElementById('pt-email').value,
        phone: document.getElementById('pt-phone').value,
        website: document.getElementById('pt-website').value,
        pib: document.getElementById('pt-pib').value,
        mb: document.getElementById('pt-mb').value,

        type: document.getElementById('pt-type').value,
        user_id: currentUser.id
    });

    ptModal.classList.add('hidden');

   resetPartnerForm()

    await fetchPartners();
    renderPartners();
});

// ------------------------------------ CANCEl ------------------------------------
document.getElementById('cy-cancel').addEventListener('click', () => {
    whModal.classList.add('hidden');
});

document.getElementById('pt-cancel').addEventListener('click', () => {
    ptModal.classList.add('hidden');
});


// ------------------------------------ RESET FOMRS ------------------------------------
function resetCompanyForm() {

    document.getElementById('cy-name').value = '';
    document.getElementById('cy-address').value = '';
    document.getElementById('cy-email').value = '';
    document.getElementById('cy-phone').value = '';
    document.getElementById('cy-website').value = '';
    document.getElementById('cy-pib').value = '';
    document.getElementById('cy-mb').value = '';
    document.getElementById('cy-bank').value = "";
    document.getElementById('cy-iban').value = "";
    document.getElementById('cy-swift').value = "";
    document.getElementById('cy-vat').value = ""

}

function resetPartnerForm() {

    document.getElementById('pt-name').value = '';
    document.getElementById('pt-address').value = '';
    document.getElementById('pt-email').value = '';
    document.getElementById('pt-phone').value = '';
    document.getElementById('pt-website').value = '';
    document.getElementById('pt-pib').value = '';
    document.getElementById('pt-mb').value = '';
    document.getElementById('pt-type').value = 'supplier';

}









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
        item: "ARTIKL",
        inventory: "INVENTAR",
        dashboard: "PREGLED",
        transaction: "TRANSAKCIJA",

        save: "Sačuvaj",
        edit: "Izmeni",
        archive: "Arhiva",
        cancel: "Otkaži",
        add: "+Dodaj",
        receiveBtn: "+ Prijem",
        issueBtn: "- Otprem",
        restore: "Vrati",
        addNewItem: "+ Dodaj novi artikal",
        pcs: "kom",


        prev: "◀ Nazad",
        next: "Napred ▶",

        saved: "Sačuvano",
        added: "Dodat",
        updated: "izmenjen",
        noItemSelected: "Artikal nije selektovan!",
        archiveInfo: "Deo je uspesno arhiviran!",


        archiveTitle: "Arhiviraj artikal",
        archiveMessage1: "Ovaj artikal će biti premešten u arhivu. Možeš ga kasnije vratiti.",
        archiveMessage2: "⚠️ Artikal će biti uklonjen iz aplikacije i dostupan samo u arhivi.",


        editTitle: "Izmeni artikal",
        noItems: "Nema artikala",
        noItem: "Nema artikla",

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
        colQuantity: "KOLICINA",
        colStatus: "STATUS",
        colPrice: "CENA",
        colTotal: "UKUPNO",

        MangTitle: "Panel Upravljanja",

        // ADD FORMA
        addModulTitle: "Dodaj novi artikal",

        addModuleName: "Naziv *",
        addModuleCode: "Šifra",
        addModuleLocation: "Lokacija",
        addModuleQuantity: "Količina *",
        addModuleStatus:"Status",
        addModulePrice: 'Cena *',
        historyLog: "Istorija",
        noHistoryYet:"Bez izmena...",
        //Placeholders
        phName: "Unesi naziv artikla...",
        phQuantity: "Unesi količinu...",
        phPrice: "Unesi cenu po komadu...",
        phLimit: "Minimalna zaliha...",
        phCode: "Šifra artikla...",
        phStatus: "NOV...",
        phLocation: "M2-P2-R1-P4",

        created: "Kreirano: ",

        TotalItems:"Ukupno artikla",
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

        // NOTIFICATIONS
        fillRequired: "Popuni sva obavezna polja",
        itemAddedTx: "Artikal dodat u transakciju",
        invalidInput: "Nevažeći unos",
        updatedSuccess: "Uspešno izmenjeno",
        itemExists: "Artikal je već dodat",

        enterQty: "Unesi količinu za →",
        noItemsTx: "Nema dodatih artikala",
        outOfStock: "nije na stanju",
        notEnoughStock: "Nema dovoljno zaliha za",

        txSuccess: "Transakcija završena",

        errCreateItem: "Greška pri kreiranju artikla",
        errCreateTx: "Greška pri kreiranju transakcije",
        errInsertTxItem: "Greška pri dodavanju stavke",
        errUpdateStock: "Greška pri ažuriranju stanja",

        itemRestored: "Artikal vraćen",
        noResults: "Nema rezultata",

        notAllowed: "Nije dozvoljeno u ovom režimu",

        // SIDEBAR
        sidebar_menu: "Meni",
        sidebar_profile: "Profil",
        sidebar_settings: "Podešavanja",
        sidebar_archive: "Arhiva",
        sidebar_logout: "Odjava",
        sidebar_Cy: "Kompanija",
        sidebar_Partner: "Partner",
        
        //SECTION TITLE
        itemDetails: "Detalji artikla",
        adjustQuantity: "Izmena količine",
        lowStockItems: "Artikli sa malim zalihama",

        //ToggleBTN
        toggleMore: "+ Vise",
        toggleHide: "- Sakri",

        NoLowStockItems: "Bez kritičnih Artikala",
        NoArchivetems: "Bez Arhiviranih Artikala",
        NoTransactions : "Bez Transakcija",

        //TRANSACTION
        transactionsTitle: "Transakcije",
        txType: "TIP",
        txDate: "DATUM",
        txAction: "AKCIJA",

        //TRANSACTION MODULE
        txNewReceipt: "Nova PRIJEMNICA",
        txNewIssue: "Nova OTPREMNICA",
        txSearchPlaceholder: "Pretraži artikal...",
        txSelectedItems: "Izabrani artikli",
        txGeneratePDF: "Generiši PDF",
        company:"Kompanija *",
        partner:"Partner *",

        selectCompany: "Izaberi kompaniju",
        selectPartner: "Izaberi partnera",

        quickTransaction: "Brza transakcija",

        // CONFIRM MODAL
        confirmTitle: "Potvrda akcije",
        confirmQuestion: "Da li ste sigurni?",
        removeItemQuestion: "Da li ste sigurni da želite da uklonite ovu stavku?",
        confirm: "Potvrdi",
        cancel: "Otkaži",

        //TRANSACTION ID
        transactionID: "ID Transakcije:",

        // My CY & My Partner => VIEW
        cyPageTitle: "Moja kompanija",
        ptPageTitle: "Moji partneri",

        addCompany: "+ Dodaj kompaniju",
        addPartner: "+ Dodaj partnera",
        noCompany: "Nema kompanije",
        noPartners: "Nema partnera",
        companyRemoved: "Kompanija uklonjena",
        partnerDeleted: "Partner uklonjen",
        CyPartenr: "Kompanija & Partner",

        //My WH & My Partner => FORMs
        cyTitle: "Dodaj Kompaniju",
        ptTitle: "Dodaj Partnera",

        cyName: "Naziv *",
        cyAddress: "Adresa",

        type: "Tip",
        supplier: "Dobavljač",
        customer: "Kupac",

        // INVOICE PDF
        invoice: "FAKTURA",
        from: "OD:",
        billTo: "ZA:",
        email: "Email",
        pib: "PIB",
        mb: "MB:",
        receipt: "PRIJEM",
        issue: "OTPREM",
        subtotal: "Medjuzbir",
        vat: "PDV",
        total: "UKUPNO",
        ourCompany: "NASA FIRMA",
        contact: "KONTAKT",
        paymentDetails: "PLACANJE",
        phone: "Telefon",
        web: "Web",
        bank: "Banka",
        pdfLoadError: "Greška pri učitavanju stavki",
        pdfGenerationFailed: "Greška pri generisanju PDF-a"

    },

    en: {
        
        item: "ITEM",
        inventory: "INVENTORY",
        dashboard: "DASHBOARD",
        transaction: "TRANSACTION",

        save: "Save",
        edit: "Edit",
        archive: "Archive",
        cancel: "Cancel",
        add: "+Add",
        receiveBtn: "+ Receive",
        issueBtn: "- Issue",
        restore: "Restore",
        addNewItem: "+ Add new item",
        pcs: "pcs",


        prev: "◀ Back",
        next: "Next ▶",

        saved: "Saved",
        added: "Added",
        updated: "Updated",
        noItemSelected: "Item is not selected!",
        archiveInfo: "Item is successfully archived!",


        archiveTitle: "Archive Item",
        archiveMessage1: "This item will be moved to archive. You can restore it later.",
        archiveMessage2: "⚠️ Item will be removed from the application and available only in the archive.",


        editTitle: "Edit item",
        noItems: "No items",
        noItem: "No item",

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
        colTotal: "TOTAL",

        MangTitle: "Management panel",

        addModulTitle: "Add new item",
        // ADD FORMA
        addModuleName: "Name *",
        addModuleCode: "Code",
        addModuleLocation: "Location",
        addModuleQuantity: "Quantity *",
        addModuleStatus:"Status",
        addModulePrice: 'Price *',
        historyLog: "History",
        noHistoryYet:"No History yet...",

        addModuleLimit: "Limit *",
        //Placeholders
        phName: "Enter name...",
        phQuantity: "Enter quantity...",
        phPrice: "Enter price per unit...",
        phLimit: "Minimum stock...",
        phCode: "Item code...",
        phStatus: "NEW",
        phLocation: "M2-P2-R1-P4",

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

        fillRequired: "Fill all required fields",
        itemAddedTx: "Item added to transaction",
        invalidInput: "Invalid input",
        updatedSuccess: "Updated successfully",
        itemExists: "Item already selected",

        enterQty: "Enter quantity for →",
        noItemsTx: "No items added",
        outOfStock: "is out of stock",
        notEnoughStock: "Not enough stock for",

        txSuccess: "Transaction completed",

        errCreateItem: "Error creating item",
        errCreateTx: "Error creating transaction",
        errInsertTxItem: "Error inserting item",
        errUpdateStock: "Error updating stock",

        itemRestored: "Item restored",
        noResults: "No results found",

        notAllowed: "It is not allowed in this mode.",


        // SIDEBAR
        sidebar_menu: "Menu",
        sidebar_profile: "Profile",
        sidebar_settings: "Settings",
        sidebar_archive: "Archive",
        sidebar_logout: "Logout",
        sidebar_Cy: "Company",
        sidebar_Partner: "Partner",

        //SECTION TITLE
        itemDetails: "Item Details",
        adjustQuantity: "Adjust Quantity",
        lowStockItems: "Low Stock Items",

        //ToggleBTN
        toggleMore: "+ More",
        toggleHide: "- Hide",

        NoLowStockItems: "No Low Stock Items",
        NoArchivetems:  "No Archive Items",
        NoTransactions : "No Transactions",

        //TRANSACTION
        transactionsTitle: "Transactions",
        txType: "TYPE",
        txDate: "DATE",
        txAction: "ACTION",

        //TRANSACTION MODULE
        txNewReceipt: "New RECEIPT",
        txNewIssue: "New ISSUE",
        txSearchPlaceholder: "Search item...",
        txSelectedItems: "Selected items",
        txGeneratePDF: "Generate PDF",
        company:"Company *",
        partner:"Partner *",

        selectCompany: "Select company",
        selectPartner: "Select partner",

        quickTransaction: "Quick Transaction",

        //CONFIRM MODAL
        
        confirmTitle: "Confirm Action",
        confirmQuestion: "Are you sure?",
        removeItemQuestion: "Are you sure you want to remove this item?",
        confirm: "Confirm",
        cancel: "Cancel",

         //TRANSACTION ID
        transactionID: "Transaction ID:",

        // My CY & My Partner => VIEW
        cyPageTitle: "My Company",
        ptPageTitle: "My Partners",

        addCompany: "+ Add Comapny",
        addPartner: "+ Add Partner",

        noCompany: "No company yet",
        noPartners: "No partners yet",

        companyRemoved: "Company removed",
        partnerDeleted: "Partner removed",
        CyPartenr: "Company & Partner",

        //My CY FORM
        cyTitle: "Add Company",
        ptTitle: "Add Partner",

        cyName: "Name *",
        cyAddress: "Address",

        type: "Type",
        supplier: "Supplier",
        customer: "Customer",

        //INVOICE
        invoice: "INVOICE",
        from: "FROM:",
        billTo: "BILL TO:",
        email: "Email",
        pib: "PIB",
        mb: "Company No.",
        receipt: "RECEIPT",
        issue: "ISSUE",
        subtotal: "Subtotal",
        vat: "VAT",
        total: "TOTAL",
        ourCompany: "OUR COMPANY",
        contact: "CONTACT",
        paymentDetails: "PAYMENT DETAILS",
        phone: "Phone",
        web: "Web",
        bank: "Bank",
        pdfLoadError: "Failed to load items",
        pdfGenerationFailed: "PDF generation failed"




      
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

    // refresh dropdowna
    populateDropdownsQuick();
    populateDropdowns();

    renderTransactionsTable();
    renderInventoryTable();
    renderLowStockTable();
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


// -------------------- FEATURE: CONFIRM MODAL --------------------
const confirmModal = document.getElementById('confirm-modal');
const confirmText  = document.getElementById('confirm-text');
const confirmOk    = document.getElementById('confirm-ok');
const confirmCancel= document.getElementById('confirm-cancel');

let confirmCallback = null;

function openConfirm({
    text = t('confirmQuestion'),
    onConfirm = () => {}
}) {

    confirmText.textContent = text;

    confirmCallback = onConfirm;

    confirmModal.classList.remove('hidden');
}

function closeConfirm() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
}

// dugmad
confirmOk.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
});

confirmCancel.addEventListener('click', closeConfirm);

// klik outside
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirm();
});

// ========================================================== INICIALISATION ==========================================================

// PAGINATION INIT
setupInventoryPagination();
setupTransactionPagination();
setupArchivePagination();

updateAuthUI();

//UMESTO fetchItems
initUser();

renderLocationSelector();