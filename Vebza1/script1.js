const nav  = document.querySelector('.navigation');

nav.addEventListener('click', function(tab){

    const clickTab = tab.target;

    if(!clickTab.classList.contains('tab')) return
    
    const alltabs = nav.querySelectorAll('button');
    alltabs.forEach(function(btn){
        btn.classList.remove('active');
    })

    clickTab.classList.add('active');





    const views     = document.querySelectorAll('.view');
    const tabValue  = clickTab.dataset.tab

    views.forEach(function(view){
        view.classList.remove('active-view') 
    });

    const selectView = document.getElementById(tabValue + '-view');
    selectView.classList.add('active-view')
})