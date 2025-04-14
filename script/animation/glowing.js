const htmlCode = `
<button id="btn-6">
    <p>Test</p>
</button>
`;

const cssCode = `
#btn-6::before {
    content: '';
    position: absolute;
    width: 110%;
    height: 50%;
    top: 0;
    left: 0;
    background-color: white;
    transform: translateX(-100%)rotate(45deg);
    transition: all 1s;
    border-radius: 4px;
}

#btn-6 {
    transition: all 1s;
}

#btn-6:hover::before {
    transform: translateX(100%)rotate(45deg);
}

#btn-6:hover {
    background-color: red;
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);