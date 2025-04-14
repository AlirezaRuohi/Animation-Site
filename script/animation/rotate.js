  const htmlCode = `
        <button id="btn-1">
            <p>Test</p>
        </button>
`;

const cssCode = `
  #btn-1::before{
    content: "";
    position: absolute;
    left: 0;
    border-radius: 7px;
    top: 0;
    background-color: red;
    height: 100%;
    width: 100%;
    z-index: 1;
    transform-origin: bottom left;
    transform: rotate(-90deg);
    transition: all 1s;
    }
  #btn-1:hover::before{
         transform: rotate(0deg);
    }
`;

document.getElementById('html-code').textContent = htmlCode;
document.getElementById('css-code').textContent = cssCode;

document.getElementById('res').innerHTML = htmlCode;

const style = document.createElement('style');
style.innerHTML = cssCode;
document.head.appendChild(style);