// Erster Canvas (Teil 1)
const canvas = document.getElementById('webglCanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

if (!gl) {
    alert("Ihr Browser unterstützt WebGL nicht");
}

// Shader-Programme
const vsSource = `
    attribute vec3 pos;
    attribute vec4 col;
    attribute vec3 normal;

    varying vec4 vColor;
    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    void main() {
        vColor = col;
        vNormal = mat3(modelViewMatrix) * normal; // Transformierte Normalen
        vPosition = vec3(modelViewMatrix * vec4(pos, 1.0)); // Position im Kameraraum
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const fsSource = `
    precision mediump float;

    varying vec4 vColor;
    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform vec3 lightPosition; // Position der Lichtquelle
    uniform vec3 viewPosition;  // Position der Kamera

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(lightPosition - vPosition);
        vec3 viewDir = normalize(viewPosition - vPosition);
        vec3 reflectDir = reflect(-lightDir, normal);

        float diff = max(dot(normal, lightDir), 0.0); // Diffuse Beleuchtung
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0); // Spekularanteil

        vec3 ambient = 0.2 * vColor.rgb; // Ambienter Anteil
        vec3 diffuse = diff * vColor.rgb; // Diffuser Anteil
        vec3 specular = spec * vec3(1.0); // Weißer Spekularanteil

        gl_FragColor = vec4(ambient + diffuse + specular, vColor.a);
    }
`;

// Shader erstellen und kompilieren
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

const vs = compileShader(gl.VERTEX_SHADER, vsSource);
const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);

const prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
}
gl.useProgram(prog);

// Uniform Locations
const modelViewMatrixLoc = gl.getUniformLocation(prog, 'modelViewMatrix');
const projectionMatrixLoc = gl.getUniformLocation(prog, 'projectionMatrix');
const lightPositionLoc = gl.getUniformLocation(prog, 'lightPosition');
const viewPositionLoc = gl.getUniformLocation(prog, 'viewPosition');

// Variablen für den Anzeigemodus
let displayModeTorus = "color"; // "color" oder "wireframe"
let displayModeKnot = "color";  // "color" oder "wireframe"

// Puffer für Torus und Torus-Knoten
let torusVertices, torusNormals, torusColors, torusIndicesTris, torusIndicesLines;
let knotVertices, knotNormals, knotColors, knotIndicesTris, knotIndicesLines;

// Initialisiere die Torus- und Torus-Knoten-Daten
createVertexDataTorus();
createVertexDataTorusKnot();

// Initialisiere Vertex-Buffer und Attribute
function setupBuffer(vertices, normals, colors, indicesTris, indicesLines) {
    const vboPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const vboNormal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboNormal);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

    const vboCol = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboCol);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    const iboTris = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboTris);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesTris, gl.STATIC_DRAW);

    const iboLines = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboLines);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesLines, gl.STATIC_DRAW);

    return { vboPos, vboNormal, vboCol, iboTris, iboLines, numTris: indicesTris.length, numLines: indicesLines.length };
}

const torusBuffer = setupBuffer(torusVertices, torusNormals, torusColors, torusIndicesTris, torusIndicesLines);
const knotBuffer = setupBuffer(knotVertices, knotNormals, knotColors, knotIndicesTris, knotIndicesLines);

// Kamera-Parameter
let cameraAngle = 45 * Math.PI / 180;
let cameraRadius = 400;
const cameraHeight = 0;

// Matrices
const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();

mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000);

// Licht- und Kamera-Position setzen
gl.uniform3fv(lightPositionLoc, [100.0, 300.0, 200.0]);
gl.uniform3fv(viewPositionLoc, [0.0, 0.0, 500.0]);

// Steuerungselemente referenzieren
const cameraAngleSlider = document.getElementById('cameraAngleSlider');
const cameraRadiusSlider = document.getElementById('cameraRadiusSlider');
const displayModeTorusCheckbox = document.getElementById('displayModeTorusCheckbox');
const displayModeKnotCheckbox = document.getElementById('displayModeKnotCheckbox');

// Initiale Werte setzen
cameraAngleSlider.value = (cameraAngle * 180 / Math.PI).toFixed(0);
cameraRadiusSlider.value = cameraRadius;

// Event Listener hinzufügen
cameraAngleSlider.addEventListener('input', function() {
    cameraAngle = parseFloat(this.value) * Math.PI / 180;
});

cameraRadiusSlider.addEventListener('input', function() {
    cameraRadius = parseFloat(this.value);
});

displayModeTorusCheckbox.addEventListener('change', function() {
    displayModeTorus = this.checked ? 'wireframe' : 'color';
});

displayModeKnotCheckbox.addEventListener('change', function() {
    displayModeKnot = this.checked ? 'wireframe' : 'color';
});

// Tastaturinteraktion
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        cameraAngle += 0.05;
        cameraAngleSlider.value = (cameraAngle * 180 / Math.PI).toFixed(0);
    }
    if (e.key === 'ArrowRight') {
        cameraAngle -= 0.05;
        cameraAngleSlider.value = (cameraAngle * 180 / Math.PI).toFixed(0);
    }
    if (e.key === 'n') {
        cameraRadius += 5;
        cameraRadiusSlider.value = cameraRadius;
    }
    if (e.key === 'N') {
        cameraRadius = Math.max(50, cameraRadius - 5);
        cameraRadiusSlider.value = cameraRadius;
    }
    if (e.key === 't') {
        toggleDisplayModeTorus();
        displayModeTorusCheckbox.checked = (displayModeTorus === 'wireframe');
    }
    if (e.key === 'k') {
        toggleDisplayModeKnot();
        displayModeKnotCheckbox.checked = (displayModeKnot === 'wireframe');
    }
});


// Szene zeichnen
function drawScene() {
    gl.clearColor(0.95, 0.95, 0.95, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    const eye = [
        Math.cos(cameraAngle) * cameraRadius,
        cameraHeight,
        Math.sin(cameraAngle) * cameraRadius,
    ];
    mat4.lookAt(viewMatrix, eye, [0, 0, 0], [0, 1, 0]);

    drawObject(torusBuffer, displayModeTorus);
    drawObject(knotBuffer, displayModeKnot);
}

function drawObject(buffer, mode) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vboPos);
    const posAttrib = gl.getAttribLocation(prog, 'pos');
    gl.vertexAttribPointer(posAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posAttrib);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vboNormal);
    const normalAttrib = gl.getAttribLocation(prog, 'normal');
    gl.vertexAttribPointer(normalAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(normalAttrib);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vboCol);
    const colAttrib = gl.getAttribLocation(prog, 'col');
    gl.vertexAttribPointer(colAttrib, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colAttrib);

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, mat4.mul(mat4.create(), viewMatrix, modelMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, projectionMatrix);

    if (mode === "color") {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.iboTris);
        gl.drawElements(gl.TRIANGLES, buffer.numTris, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer.iboLines);
    gl.drawElements(gl.LINES, buffer.numLines, gl.UNSIGNED_SHORT, 0);
}

// Anzeigemodus für Torus umschalten
function toggleDisplayModeTorus() {
    displayModeTorus = displayModeTorus === "color" ? "wireframe" : "color";
    drawScene();
}

// Anzeigemodus für Torus-Knoten umschalten
function toggleDisplayModeKnot() {
    displayModeKnot = displayModeKnot === "color" ? "wireframe" : "color";
    drawScene();
}

function animate() {
    drawScene();
    requestAnimationFrame(animate);
}

animate();

// Daten für Torus und Torus-Knoten
function createVertexDataTorus() {
    const majorSegments = 64;
    const minorSegments = 32;
    const majorRadius = 100;
    const minorRadius = 10;

    torusVertices = [];
    torusNormals = [];
    torusColors = [];
    torusIndicesTris = [];
    torusIndicesLines = [];

    for (let i = 0; i <= majorSegments; i++) {
        const theta = (i / majorSegments) * 2 * Math.PI;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);

        for (let j = 0; j <= minorSegments; j++) {
            const phi = (j / minorSegments) * 2 * Math.PI;
            const cosPhi = Math.cos(phi);
            const sinPhi = Math.sin(phi);

            const x = (majorRadius + minorRadius * cosPhi) * cosTheta;
            const y = (majorRadius + minorRadius * cosPhi) * sinTheta;
            const z = minorRadius * sinPhi;
            torusVertices.push(x, y, z);

            const nx = cosPhi * cosTheta;
            const ny = cosPhi * sinTheta;
            const nz = sinPhi;
            torusNormals.push(nx, ny, nz);

            const brightness = 1.1 + 0.4 * sinPhi;
            const clampedBrightness = Math.min(brightness, 1.0);
            torusColors.push(clampedBrightness, clampedBrightness * 0.9, clampedBrightness * 0.1, 1.0);

            if (i < majorSegments && j < minorSegments) {
                const a = i * (minorSegments + 1) + j;
                const b = a + minorSegments + 1;
                torusIndicesLines.push(a, a + 1);
                torusIndicesLines.push(a, b);
                torusIndicesTris.push(a, a + 1, b);
                torusIndicesTris.push(a + 1, b + 1, b);
            }
        }
    }

    torusVertices = new Float32Array(torusVertices);
    torusNormals = new Float32Array(torusNormals);
    torusColors = new Float32Array(torusColors);
    torusIndicesTris = new Uint16Array(torusIndicesTris);
    torusIndicesLines = new Uint16Array(torusIndicesLines);
}

function createVertexDataTorusKnot() {
    const tubeSegments = 12;
    const knotSegments = 512;
    const R = 100;
    const r = 25;
    const p = 7;
    const q = 3;
    const tubeRadius = 7;

    knotVertices = [];
    knotNormals = [];
    knotColors = [];
    knotIndicesTris = [];
    knotIndicesLines = [];

    for (let i = 0; i <= knotSegments; i++) {
        const t = (i / knotSegments) * 2 * Math.PI;
        const centerX = (R + r * Math.cos(p * t)) * Math.cos(q * t);
        const centerY = (R + r * Math.cos(p * t)) * Math.sin(q * t);
        const centerZ = r * Math.sin(p * t);

        for (let j = 0; j <= tubeSegments; j++) {
            const phi = (j / tubeSegments) * 2 * Math.PI;
            const cosPhi = Math.cos(phi);
            const sinPhi = Math.sin(phi);

            const x = centerX + tubeRadius * cosPhi * Math.cos(q * t);
            const y = centerY + tubeRadius * cosPhi * Math.sin(q * t);
            const z = centerZ + tubeRadius * sinPhi;
            knotVertices.push(x, y, z);

            const nx = cosPhi * Math.cos(q * t);
            const ny = cosPhi * Math.sin(q * t);
            const nz = sinPhi;
            knotNormals.push(nx, ny, nz);

            const brightness = 0.9 + 0.4 * sinPhi;
            const clampedBrightness = Math.min(brightness, 1.0);
            knotColors.push(clampedBrightness, clampedBrightness * 0.4, clampedBrightness * 0.9, 1.0);

            if (i < knotSegments && j < tubeSegments) {
                const a = i * (tubeSegments + 1) + j;
                const b = a + tubeSegments + 1;
                knotIndicesLines.push(a, a + 1);
                knotIndicesLines.push(a, b);
                knotIndicesTris.push(a, a + 1, b);
                knotIndicesTris.push(a + 1, b + 1, b);
            }
        }
    }

    knotVertices = new Float32Array(knotVertices);
    knotNormals = new Float32Array(knotNormals);
    knotColors = new Float32Array(knotColors);
    knotIndicesTris = new Uint16Array(knotIndicesTris);
    knotIndicesLines = new Uint16Array(knotIndicesLines);
}

// Zweites Canvas (Teil 2)
const canvas2 = document.getElementById('webglCanvas2');
const gl2 = canvas2.getContext('webgl') || canvas2.getContext('experimental-webgl');

if (!gl2) {
    alert("Ihr Browser unterstützt WebGL nicht im zweiten Canvas");
}

// Shader-Programme für das zweite Canvas
const vsSource2 = `
    attribute vec3 pos;
    attribute vec4 col;
    attribute vec3 normal;

    varying vec4 vColor;
    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;

    void main() {
        vColor = col;
        vNormal = mat3(modelViewMatrix) * normal;
        vPosition = vec3(modelViewMatrix * vec4(pos, 1.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const fsSource2 = `
    precision mediump float;

    varying vec4 vColor;
    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform vec3 lightPosition;
    uniform vec3 viewPosition;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(lightPosition - vPosition);
        vec3 viewDir = normalize(viewPosition - vPosition);
        vec3 reflectDir = reflect(-lightDir, normal);

        float diff = max(dot(normal, lightDir), 0.0);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);

        vec3 ambient = 0.2 * vColor.rgb;
        vec3 diffuse = diff * vColor.rgb;
        vec3 specular = spec * vec3(1.0);

        gl_FragColor = vec4(ambient + diffuse + specular, vColor.a);
    }
`;

// Shader erstellen und kompilieren für gl2
function compileShader2(glContext, type, source) {
    const shader = glContext.createShader(type);
    glContext.shaderSource(shader, source);
    glContext.compileShader(shader);
    if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
        console.error(glContext.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

const vs2 = compileShader2(gl2, gl2.VERTEX_SHADER, vsSource2);
const fs2 = compileShader2(gl2, gl2.FRAGMENT_SHADER, fsSource2);

const prog2 = gl2.createProgram();
gl2.attachShader(prog2, vs2);
gl2.attachShader(prog2, fs2);
gl2.linkProgram(prog2);
if (!gl2.getProgramParameter(prog2, gl2.LINK_STATUS)) {
    console.error(gl2.getProgramInfoLog(prog2));
}
gl2.useProgram(prog2);

// Uniform Locations
const modelViewMatrixLoc2 = gl2.getUniformLocation(prog2, 'modelViewMatrix');
const projectionMatrixLoc2 = gl2.getUniformLocation(prog2, 'projectionMatrix');
const lightPositionLoc2 = gl2.getUniformLocation(prog2, 'lightPosition');
const viewPositionLoc2 = gl2.getUniformLocation(prog2, 'viewPosition');

// Variablen für Rekursionstiefe und Anzeigemodus
let recursionDepth = 0; // Initiale Tiefe
let displayModeSphere = "fill"; // "fill" oder "wireframe"

// Kamera-Parameter für das zweite Canvas
let cameraAngle2 = 0;
let cameraRadius2 = 4;
let cameraHeight2 = 0;

// Matrices
const modelMatrix2 = mat4.create();
const viewMatrix2 = mat4.create();
const projectionMatrix2 = mat4.create();

mat4.perspective(projectionMatrix2, Math.PI / 4, canvas2.width / canvas2.height, 0.1, 100);

// Licht- und Kamera-Position setzen
gl2.uniform3fv(lightPositionLoc2, [10.0, 10.0, 10.0]);
gl2.uniform3fv(viewPositionLoc2, [0.0, 0.0, 5.0]);

// Puffer für die Kugel
let sphereVertices = [];
let sphereNormals = [];
let sphereColors = [];
let sphereIndicesTris = [];
let sphereIndicesLines = [];

// Kugeldaten erstellen
createSphereData();
let sphereBuffer = setupSphereBuffers();

// Steuerungselemente referenzieren
const recursionDepthSlider = document.getElementById('recursionDepthSlider');
const cameraAngle2Slider = document.getElementById('cameraAngle2Slider');
const cameraRadius2Slider = document.getElementById('cameraRadius2Slider');
const displayModeSphereCheckbox = document.getElementById('displayModeSphereCheckbox');

// Initiale Werte setzen
recursionDepthSlider.value = recursionDepth;
cameraAngle2Slider.value = (cameraAngle2 * 180 / Math.PI).toFixed(0);
cameraRadius2Slider.value = cameraRadius2;

// Event Listener hinzufügen
recursionDepthSlider.addEventListener('input', function() {
    recursionDepth = parseInt(this.value);
    recreateSphere();
});

cameraAngle2Slider.addEventListener('input', function() {
    cameraAngle2 = parseFloat(this.value) * Math.PI / 180;
});

cameraRadius2Slider.addEventListener('input', function() {
    cameraRadius2 = parseFloat(this.value);
});

displayModeSphereCheckbox.addEventListener('change', function() {
    displayModeSphere = this.checked ? 'wireframe' : 'fill';
});


// Tastaturinteraktion
window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case '+':
            recursionDepth++;
            if (recursionDepth > 5) recursionDepth = 5;
            recreateSphere();
            recursionDepthSlider.value = recursionDepth;
            break;
        case '-':
            recursionDepth--;
            if (recursionDepth < 0) recursionDepth = 0;
            recreateSphere();
            recursionDepthSlider.value = recursionDepth;
            break;
        case 'g':
            toggleDisplayModeSphere();
            displayModeSphereCheckbox.checked = (displayModeSphere === 'wireframe');
            break;
        case 'a':
            cameraAngle2 -= 0.05;
            cameraAngle2Slider.value = (cameraAngle2 * 180 / Math.PI).toFixed(0);
            break;
        case 'd':
            cameraAngle2 += 0.05;
            cameraAngle2Slider.value = (cameraAngle2 * 180 / Math.PI).toFixed(0);
            break;
        case 'w':
            cameraRadius2 += 0.1;
            cameraRadius2Slider.value = cameraRadius2.toFixed(1);
            break;
        case 's':
            cameraRadius2 -= 0.1;
            cameraRadius2Slider.value = cameraRadius2.toFixed(1);
            break;
    }
});

function recreateSphere() {
    createSphereData();
    sphereBuffer = setupSphereBuffers();
}

function toggleDisplayModeSphere() {
    displayModeSphere = displayModeSphere === "fill" ? "wireframe" : "fill";
}

function drawScene2() {
    gl2.clearColor(0.95, 0.95, 0.95, 1.0);
    gl2.clear(gl2.COLOR_BUFFER_BIT | gl2.DEPTH_BUFFER_BIT);
    gl2.enable(gl2.DEPTH_TEST);

    const eye = [
        Math.cos(cameraAngle2) * cameraRadius2,
        cameraHeight2,
        Math.sin(cameraAngle2) * cameraRadius2,
    ];
    mat4.lookAt(viewMatrix2, eye, [0, 0, 0], [0, 1, 0]);

    drawSphere();
}

function drawSphere() {
    gl2.bindBuffer(gl2.ARRAY_BUFFER, sphereBuffer.vboPos2);
    const posAttrib2 = gl2.getAttribLocation(prog2, 'pos');
    gl2.vertexAttribPointer(posAttrib2, 3, gl2.FLOAT, false, 0, 0);
    gl2.enableVertexAttribArray(posAttrib2);

    gl2.bindBuffer(gl2.ARRAY_BUFFER, sphereBuffer.vboNormal2);
    const normalAttrib2 = gl2.getAttribLocation(prog2, 'normal');
    gl2.vertexAttribPointer(normalAttrib2, 3, gl2.FLOAT, false, 0, 0);
    gl2.enableVertexAttribArray(normalAttrib2);

    gl2.bindBuffer(gl2.ARRAY_BUFFER, sphereBuffer.vboCol2);
    const colAttrib2 = gl2.getAttribLocation(prog2, 'col');
    gl2.vertexAttribPointer(colAttrib2, 4, gl2.FLOAT, false, 0, 0);
    gl2.enableVertexAttribArray(colAttrib2);

    gl2.uniformMatrix4fv(modelViewMatrixLoc2, false, mat4.mul(mat4.create(), viewMatrix2, modelMatrix2));
    gl2.uniformMatrix4fv(projectionMatrixLoc2, false, projectionMatrix2);

    if (displayModeSphere === "fill") {
        gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, sphereBuffer.iboTris2);
        gl2.drawElements(gl2.TRIANGLES, sphereBuffer.numTris, gl2.UNSIGNED_SHORT, 0);
    } else {
        gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, sphereBuffer.iboLines2);
        gl2.drawElements(gl2.LINES, sphereBuffer.numLines, gl2.UNSIGNED_SHORT, 0);
    }
}

function animate2() {
    drawScene2();
    requestAnimationFrame(animate2);
}

animate2();

// Funktionen zur Erstellung der Kugel
function createSphereData() {
    sphereVertices = [];
    sphereNormals = [];
    sphereColors = [];
    sphereIndicesTris = [];
    sphereIndicesLines = [];

    // Initiale Punkte des Oktaeders
    const v0 = [1, 0, 0];
    const v1 = [-1, 0, 0];
    const v2 = [0, 1, 0];
    const v3 = [0, -1, 0];
    const v4 = [0, 0, 1];
    const v5 = [0, 0, -1];

    // Initiale Dreiecke des Oktaeders
    let initialTriangles = [
        [v0, v2, v4],
        [v2, v1, v4],
        [v1, v3, v4],
        [v3, v0, v4],
        [v2, v0, v5],
        [v1, v2, v5],
        [v3, v1, v5],
        [v0, v3, v5]
    ];

    // Rekursive Unterteilung
    for (let i = 0; i < initialTriangles.length; i++) {
        subdivideTriangle(initialTriangles[i][0], initialTriangles[i][1], initialTriangles[i][2], recursionDepth);
    }

    sphereVertices = new Float32Array(sphereVertices);
    sphereNormals = new Float32Array(sphereNormals);
    sphereColors = new Float32Array(sphereColors);
    sphereIndicesTris = new Uint16Array(sphereIndicesTris);
    sphereIndicesLines = new Uint16Array(sphereIndicesLines);
}

function subdivideTriangle(a, b, c, depth) {
    if (depth === 0) {
        addTriangle(a, b, c);
    } else {
        let ab = normalize(midpoint(a, b));
        let ac = normalize(midpoint(a, c));
        let bc = normalize(midpoint(b, c));

        subdivideTriangle(a, ab, ac, depth - 1);
        subdivideTriangle(ab, b, bc, depth - 1);
        subdivideTriangle(bc, c, ac, depth - 1);
        subdivideTriangle(ab, bc, ac, depth - 1);
    }
}

function midpoint(u, v) {
    return [
        (u[0] + v[0]) / 2,
        (u[1] + v[1]) / 2,
        (u[2] + v[2]) / 2
    ];
}

function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

function addTriangle(a, b, c) {
    const index = sphereVertices.length / 3;

    sphereVertices.push(...a);
    sphereVertices.push(...b);
    sphereVertices.push(...c);

    sphereNormals.push(...a);
    sphereNormals.push(...b);
    sphereNormals.push(...c);

    const colorA = [(a[0]+1)/2, (a[1]+1)/2, (a[2]+1)/2, 1];
    const colorB = [(b[0]+1)/2, (b[1]+1)/2, (b[2]+1)/2, 1];
    const colorC = [(c[0]+1)/2, (c[1]+1)/2, (c[2]+1)/2, 1];

    sphereColors.push(...colorA);
    sphereColors.push(...colorB);
    sphereColors.push(...colorC);

    sphereIndicesTris.push(index, index+1, index+2);

    sphereIndicesLines.push(index, index+1);
    sphereIndicesLines.push(index+1, index+2);
    sphereIndicesLines.push(index+2, index);
}

function setupSphereBuffers() {
    const vboPos2 = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, vboPos2);
    gl2.bufferData(gl2.ARRAY_BUFFER, sphereVertices, gl2.STATIC_DRAW);

    const vboNormal2 = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, vboNormal2);
    gl2.bufferData(gl2.ARRAY_BUFFER, sphereNormals, gl2.STATIC_DRAW);

    const vboCol2 = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, vboCol2);
    gl2.bufferData(gl2.ARRAY_BUFFER, sphereColors, gl2.STATIC_DRAW);

    const iboTris2 = gl2.createBuffer();
    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, iboTris2);
    gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, sphereIndicesTris, gl2.STATIC_DRAW);

    const iboLines2 = gl2.createBuffer();
    gl2.bindBuffer(gl2.ELEMENT_ARRAY_BUFFER, iboLines2);
    gl2.bufferData(gl2.ELEMENT_ARRAY_BUFFER, sphereIndicesLines, gl2.STATIC_DRAW);

    return { vboPos2, vboNormal2, vboCol2, iboTris2, iboLines2, numTris: sphereIndicesTris.length, numLines: sphereIndicesLines.length };
}
