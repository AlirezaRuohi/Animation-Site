const htmlCode = `
<button id="btn-7">
    <p></p>
</button>
`;

const cssCode = `
#btn-7::before {
    content: 'Test';
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;

    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    transition: all 1s;
}

#btn-7::after {
    content: 'Test';
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    width: 100%;
    border-radius: 7px;
    background-color: red;
    height: 100%;
    top: 0;
    left: 0;
    transition: all 1s;
    transform: translate(-100%, 100%);
}

#btn-7:hover::before {
    transform: translate(100%, -100%);
}

#btn-7:hover::after {
    transform: translate(0, 0);
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);