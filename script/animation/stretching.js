const htmlCode = `
<button id="btn-4">
    <p>Test</p>
</button>
`;

const cssCode = `
#btn-4:hover {
    padding: 20px;
    border: 2px solid red;
}
#btn-4:hover p{
    letter-spacing: 5px;
    color: blue;
    font-weight: 700;
}

#btn-4{
    transition: all .5s;
}

#btn-4 p{
    font-weight: 400;
    transition: all .5s;
}
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);