const htmlCode = `
<button id="btn-5">
    <p>Test</p>
</button>
`;

const cssCode = `
#btn-5::before{
    content: "Hi!";
    letter-spacing: 2px;
    position: absolute;
    color: white;
    background-color: red;
    top: 0;
    left: 0;
    transform-origin: top;
    width: 100%;
    height: 100%;
    transform: translateY(-100%);
    transition: all 1s;
    z-index: 3;
    display: flex;
    justify-content: center;
    align-items: center;
}
#btn-5:hover::before{
    transform: translateY(0px);
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);