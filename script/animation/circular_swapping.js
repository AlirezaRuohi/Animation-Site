const htmlCode = `
<button id="btn-9">
    <p>Test</p>
</button>
`;

const cssCode = `
#btn-9::before{
    content: '';
    width: 100%;
    height: 0%;
    position: absolute;
    background-color: black;
    top: 0;
    left: 0;
    border-radius: 0 0 50% 50%;
    transition: all 1s;
    color: white;
}
#btn-9:hover::before{
    height: 190%;
    background-color: red;
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);