function openForm(mode) {
    const form = document.getElementById('form');
    const title = document.getElementById('form-title');
    const button = document.getElementById('form-button');
    title.textContent = (mode=='login')?'Log In':'Sign Up';
    button.textContent = (mode=='signup')?'Sign Up':'Log In';
    
    form.classList.add('active');
    document.getElementById('overlay').style.visibility = 'visible';
}

function closeForm() {
    document.getElementById('form').classList.remove('active');
    document.getElementById('overlay').style.visibility = 'hidden';

}

