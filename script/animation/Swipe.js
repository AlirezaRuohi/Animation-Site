const htmlCode = `
<button id="btn-2">
    <p>Test</p>
</button>
`;

const cssCode = `
#btn-2::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    border-radius: 7px;
    background-color: red;
    height: 100%;
    width: 100%;
    z-index: 1;
    transform-origin: left;
    transform: translate(-100px);
    transition: all 1s;
}
#btn-2:hover::before{
    transform: translate(0px);
    color: white;
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);