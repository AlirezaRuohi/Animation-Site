const htmlCode = `
<button id="btn-3">
    <p>Test</p>
</button>
`;

const cssCode = `
#btn-3::before{
    content: "";
    position: absolute;
    left: 0;
    border-radius: 7px;
    top: 0;
    background-color: red;
    height: 100%;
    width: 100%;
    z-index: 1;
    transform: rotateY(-90deg);
    transition: all 1s;
}
#btn-3:hover::before{
    transform: rotateY(0deg);
}

#btn-3::after{
    content: "";
    position: absolute;
    left: 0;
    border-radius: 7px;
    top: 0;
    background-color: red;
    height: 100%;
    width: 100%;
    z-index: 1;
    transform: rotateX(-90deg);
    transition: all 1s;
}
#btn-3:hover::after{
    transform: rotateX(0deg);
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);