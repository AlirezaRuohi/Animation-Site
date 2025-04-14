const htmlCode = `
<button id="btn-10">
    <p>Test</p>
</button>
`;

const cssCode = `
#btn-10::before {
    content: 'Test';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    transform: rotateX(270deg);
    transform-origin: top;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: red;
    border-radius: 7px;
    color: black;
    transition: all 1s;
    z-index: 1;
}

#btn-10{
    overflow: visible;
}
#btn-10:hover::before {
    transform: rotateX(0deg);
}

#btn-10 p {
    z-index: 0;
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);