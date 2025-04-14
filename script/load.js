
const urlParams = new URLSearchParams(window.location.search);
const text = urlParams.get('text');
document.getElementById('animation-name').innerText = text;


switch (text) {
    case 'Rotate':
        loadScript('../script/animation/rotate.js');
        break;
    case 'Swipe':
        loadScript('../script/animation/swipe.js');
        break;
    case 'Hover':
        loadScript('../script/animation/hover.js');
        break;
    case 'Stretching':
        loadScript('../script/animation/stretching.js');
        break;
    case 'Swipe - Top':
        loadScript('../script/animation/swipe_top.js');
        break;
    case 'Glowing':
        loadScript('../script/animation/glowing.js');
        break;
    case 'Two - Layers':
        loadScript('../script/animation/two_layers.js');
        break;
    case 'Text - Scaling':
        loadScript('../script/animation/text_scaling.js');
        break;
    case 'Circular-Swapping':
        loadScript('../script/animation/circular_swapping.js');
        break;
    case 'Layer':
        loadScript('../script/animation/layer.js');
        break;
    case 'Layer - Swipe':
        loadScript('../script/animation/layer_swipe.js');
        break;
    case 'Splited':
        loadScript('../script/animation/splited.js');
        break;
}



function loadScript(scriptName) {
    const script = document.createElement('script');
    script.src = scriptName;
    script.type = 'text/javascript';
    document.body.appendChild(script);
}