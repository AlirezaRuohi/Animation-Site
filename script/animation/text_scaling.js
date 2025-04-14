const htmlCode = `
<button id="btn-8">
    <p>Test</p>
</button>
`;

const cssCode = `
#btn-8::before{
    content: 'Test';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    color: white;
    background-color: red;
    transform: scale(5);
    transition: all 1s;
    opacity: 0;
    display: flex;
    justify-content: center;
    align-items: center;
}
#btn-8:hover::before{
    transform: scale(1);
    opacity: 1;
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);