

const navigation = document.querySelector('.navigation');

const input      = document.querySelector('#input-search');
const clearBtn   = document.querySelector('.clear-btn');

const results    = document.querySelector('.results');

const itemName      = document.getElementById('item-name');
const itemCode      = document.getElementById('item-code');
const itemLocation  = document.getElementById('item-location');

const itemQuantity  = document.querySelector('.quantity-value');
const qMinus        = document.querySelector('.btn-minus');
const qPlus         = document.querySelector('.btn-plus');

const saveBtn       = document.querySelector('.save-btn');
const notification  = document.querySelector('.notification')

const tabelBody     = document.querySelector('.table-body');

//Module
const addBtn = document.querySelector('.addBtn');
const module = document.querySelector('.modal-wrapper');

const modCancel = document.querySelector('.addCancel');
const modSave   = document.querySelector('.addSave');

const addName      = document.getElementById('addItem-nema');
const addCode      = document.getElementById('addItem-code');
const addLocation  = document.getElementById('addItem-location');
const addQuantity  = document.getElementById('addItem-quantity');

//Edit
const editBtn      = document.querySelector('.edit-btn')


//Lange
const enBtn = document.querySelector('.en');
const srBtn = document.querySelector('.sr');

const langeBtns = document.querySelectorAll('.lange-btns');
console.log(langeBtns)

let currentLang = localStorage.getItem('lang') || 'sr';

const translations = {
    sr:
        {
        //HTML
        input: "ULAZ",
        table: "TABELA",
        admin: "UPRAVLJANJE"
    },
    en:{
                //HTML
            input: "INPUT",
            table: "TABLE",
            admin: "MANAGEMNT"

    }
   
}

langeBtns.forEach(function(btn){

    btn.addEventListener('click', function(){
        const lang = btn.dataset.lang

        localStorage.setItem('lang', lang);
    })
})



let editmode = false;
let edititem = null;



let selectdItem = null;
// ================= DATA (TEST)
const items = [
    { name: "Šraf M6",      code: "1001",   location: "M3 - P6 - R5 - M23", quantity: 5 },
    { name: "Navoj M8",     code: "1002",   location: "M5-P1-R8-M34",       quantity: 30 },
    { name: "Motor M7",     code: "1003",   location: "M5-P1-R8-M34",       quantity: 10 },
    { name: "Obruga M8",    code: "1004",   location: "M5-P1-R8-M34",       quantity: 40 },
    { name: "Motor L9",     code: "2005",   location: "M5-P1-R8-M34",       quantity: 70 },
    { name: "Motor L7",     code: "2006",   location: "M5-P1-R8-M34",       quantity: 20 },
    { name: "Stator L4",    code: "2007",   location: "M5-P1-R8-M34",       quantity: 10 },
    { name: "Motor L5",     code: "3008",   location: "M5-P1-R8-M34",       quantity: 70 },
    { name: "Kocnica K6",   code: "3009",   location: "M1-P2-R9-M3",        quantity: 100 }
];

navigation.addEventListener('click', function(tab){
    //TABS
        const selectedTab = tab.target;

        const allTabs = navigation.querySelectorAll('button')

        allTabs.forEach(function(tab){
            tab.classList.remove('active');
        })
        selectedTab.classList.add('active');

    //VIEW
        const tabValue = selectedTab.dataset.tab
        if(tabValue === 'table'){
            renderTable()
        }
        
        const allViews = document.querySelectorAll('.view')
    
        allViews.forEach(function(view){
            view.classList.remove('active-view')
        });

        const showView = document.getElementById(tabValue + '-view')
        showView.classList.add('active-view');
    
});

input.addEventListener('input', function(){

   results.innerHTML = '';
   
   clearBtn.style.display = 'block';   
   results.style.display = 'block';   
    
    const inputValue = input.value.trim().toLowerCase()

    if(inputValue === ''){
        results.innerHTML = '';
        clearBtn.style.display = 'none';
        selectdItem = null;    
        itemQuantity.textContent = 0;
        return;
    } 


    const filtered = items.filter(function(item){

        if(item.name.toLowerCase().includes(inputValue) || 
        item.code.toLowerCase().includes(inputValue)){
            return true;
        }else{
            return false;
        }
    });

    filtered.forEach(function(item){

        const div  = document.createElement('div');
        div.classList.add('result-item')
        div.textContent = item.name;

        div.addEventListener('click', function(){
            
            // stavljamo u V 'selectdItem' kliknuti 'item'
            selectdItem = item;

            input.value = item.name;
            

            itemName.textContent        = item.name;
            itemCode.textContent        = item.code;
            itemLocation.textContent    = item.location;
            itemQuantity.textContent    = item.quantity

            results.innerHTML = '';
        })


        results.appendChild(div)

        
    })

});

clearBtn.addEventListener('click', function(){
    input.value = '';

    itemName.textContent = '';
    itemCode.textContent = '';
    itemLocation.textContent = '';
    itemQuantity.textContent = '';

    clearBtn.style.display = 'none';
    results.style.display = 'none';
    
    selectdItem = null;

 })

 qMinus.addEventListener('click', function(){
    if(!selectdItem) return;

    if(selectdItem.quantity > 0){
        selectdItem.quantity --;
    }
    
    itemQuantity.textContent = selectdItem.quantity;

 })

 qPlus.addEventListener('click', function(){
    if(!selectdItem) return;

    selectdItem.quantity++
    itemQuantity.textContent = selectdItem.quantity;
 })

 saveBtn.addEventListener('click', function(){
   
    if(!selectdItem){
        notification.textContent = `X No selected Item!`;
    }else{

    const currentQ = selectdItem.quantity
  
    notification.textContent = `For: ${selectdItem.name} Current Q is: ${currentQ}`;
    notification.style.display = 'flex';

    setTimeout(function(){

        notification.style.display = 'none';
    }, 3000)


    }


 })

/* =========================================================== TABELE TAB =========================================================== */

function renderTable(){
    tabelBody.innerHTML = '';

    items.forEach(function(item){

        const tr = document.createElement('tr');

        tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.code}</td>
        <td>${item.location}</td>
        <td>${item.quantity}</td>
        `
        

        tr.addEventListener('click',function(row){
            
            // set selected item da bi + - i save radili i zali sat da azuriraju
            selectdItem = item;
            
            //Stavljamo item.name u Input
            input.value = item.name;;

            
            // popuni item card
            itemName.textContent     = item.name;
            itemCode.textContent     = item.code;
            itemLocation.textContent = item.location;
            itemQuantity.textContent = item.quantity;


            document.querySelector('[data-tab="input"]').click();  //hvatamo html elment sa data-tab="input" i radimo klik na njega
            
        })


        tabelBody.appendChild(tr);
    });

}

addBtn.addEventListener('click', function(){
    module.classList.remove('hidden');
})
modCancel.addEventListener('click', function(){
    module.classList.add('hidden');
    
});

modSave.addEventListener('click', function(){

    const nameValue     = addName.value.trim();
    const codeValue     = addCode.value.trim();
    const locationValue = addLocation.value.trim();
    const quantityValue = addQuantity.value

    if(!nameValue || !codeValue || !locationValue || !quantityValue) return

if(editmode){
//Ako jeste Edit Mode

    edititem.name       = nameValue
    edititem.code       = codeValue
    edititem.location   = locationValue
    edititem.quantity   = quantityValue

    editmode = false;
    edititem = null;

}else{

// Ako nije Edit mode onda samo snimi novi Item:

    const item  = {
        name:nameValue,
        code: codeValue,
        location: locationValue,
        quantity: quantityValue
    }

    items.push(item);


}

    renderTable()

    addName.value       = ''
    addCode.value       = ''
    addLocation.value   = ''
    addQuantity.value   = ''

    module.classList.add('hidden');

})

editBtn.addEventListener('click', function(){
    if(!selectdItem) return;

    editmode = true;
    edititem = selectdItem;

    module.classList.remove('hidden');

    addName.value = edititem.name;
    addCode.value = edititem.code;
    addLocation.value = edititem.location;
    addQuantity.value = edititem.quantity;

    console.log(addName.value )

})