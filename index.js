// The idea is taken from here: http://wonderfl.net/c/md93 and adapted for WebGL
// by Andrei Kashcha (anvaka@gmail.com)
function marimo(graphics){
    var width = graphics.width || 468;
    var height = graphics.height || 468;
    var sphereR = 50;
    var particlesRate = 50;
    var hairJointsCount = 4;
    var particleVelocity = 14;
    var gravity = 2.2;
    var speedRandomRate = 1.0;
    var colorRandomRate = 0.0;

    var centerX = width/2.0;
    var centerY = height/2.0;

    var sphereColor = new Color(0, 0, 0, 1);
    var hairRootsColor = new Color(0.0, 0.0, 0.2, 1);
    var hairTipsBottomColor = new Color(0.4, 0.0, 0.5, 1);
    var hairTipsTopColor = new Color(0, 0.0, 0.3, 1);
    var speedX = [],
        speedY = [],

    createRandomSpeeds = function() {
        // Just precalculate random speed components to reuse on every frame
        for (var xri = 0; xri < particlesRate; xri++){
            var xAngle = Math.PI * xri / particlesRate;
            var r = Math.sin(xAngle) * sphereR;

            speedX[xri] = [];
            speedY[xri] = [];
            var sliceHairsCount = (particlesRate * 2 * r / sphereR) << 0;
            for (var zri = 0; zri < sliceHairsCount; zri++){
                speedX[xri][zri] = particleVelocity * speedRandomRate * (0.5 - Math.random());
                speedY[xri][zri] = particleVelocity * speedRandomRate * (0.5 - Math.random());
             }
        }
    },

    render = function () {
        graphics.beginRender();
        graphics.drawCircle(centerX, centerY, sphereR, sphereColor);

        for (var xri = 0; xri < particlesRate; xri++){
            // Start slicing sphere from back to front with circles
            // of radius r.
            var xAngle = Math.PI * xri / particlesRate;
            var r = Math.sin(xAngle) * sphereR;

            // On each of these slices draw sliceHairsCount number of hairs
            // (they grow porpotionally to the main sphere radius):
            var sliceHairsCount = (particlesRate * 2 * r / sphereR) << 0;
            for (var zri = 0; zri < sliceHairsCount; zri++){
                // Calculating where to put this hair on the current slice:
                var zAngle = 2 * Math.PI * zri / sliceHairsCount;
                var x = Math.cos(zAngle) * r;
                var y = Math.sin(zAngle) * r;

                // Where shall this hair grow?
                var vx = particleVelocity * x / sphereR;
                var vy = particleVelocity * y / sphereR;

                vx += speedX[xri][zri];
                vy += speedY[xri][zri];

                // Now we know hair start position and growth direction.
                // Let's calculate the color of the hair.
                // The color also depends on hair position on the Y axes.
                var colorRate = ((sphereR + y) / (2.0 * sphereR )) + colorRandomRate * (0.5 - Math.random());
                var startColor = mixColors(hairRootsColor, sphereColor, colorRate);
                var endColor = mixColors(hairTipsTopColor, hairTipsBottomColor, colorRate);

                // We are ready to draw this hair:
                drawHair(centerX + x, centerY + y, vx, vy, startColor, endColor);
             }
        }

        graphics.endRender();
    };


    // Simple color interpolation by each component with given rate.
    // Using result to let calling function reuse color object and reduce
    // pressure on GC.
    function mixColors(color0, color1, rate, result){
        if (typeof result === 'undefined') {
            result = new Color(0, 0, 0, 1);
        }

        if (rate <= 0) return result.set(color0);
        if (rate >= 1) return result.set(color1);

        result.r = color0.r * (1 - rate) + color1.r * rate;
        result.g = color0.g * (1 - rate) + color1.g * rate;
        result.b = color0.b * (1 - rate) + color1.b * rate;

        return result;
    }

    function drawHair(x, y, vx, vy, startColor, endColor){
        var lastColor = new Color(0, 0, 0, 1),
            currentColor = new Color(0, 0, 0, 1);
        mixColors(startColor, endColor, 0, lastColor);

        for (var i = 1; i <=hairJointsCount; ++i){
            var lastX = x;
            var lastY = y;
            vy += gravity;
            x += vx;
            y += vy;
            var rate = i / hairJointsCount;
            mixColors(startColor, endColor, rate, currentColor);
            currentColor.a = 1 - rate;
            drawLine(lastX, lastY, x, y, lastColor, currentColor);

            lastColor.set(currentColor);
        }
    }

    function drawLine(x0, y0, x1, y1, lineStart, lineEnd){
        graphics.drawLine(x0, y0, x1, y1, lineStart, lineEnd);
    };

    createRandomSpeeds();

    return {
        render: render,
        centerX : function(newCenterX) {
            if (typeof newCenterX === 'number') {
                centerX = newCenterX;
                return this;
            }
            return centerX;
        },
        centerY : function(newCenterY) {
            if (typeof newCenterY === 'number') {
                centerY = newCenterY;
                return this;
            }
            return centerY;
        },

        gravity : function(newGravity) {
            if (typeof newGravity === 'number') {
                gravity = newGravity;
                return this;
            }
            return gravity;
        }
    };
}

function Color(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    if (typeof a === 'number') {
        this.a = a;
    } else {
        this.a = 1;
    }
}

Color.prototype.set = function(otherColor) {
    this.r = otherColor.r;
    this.g = otherColor.g;
    this.b = otherColor.b;
    this.a = otherColor.a;

    return this;
}

    function loaded() {
        var webglGraphics = function(container) {
            var container = container || document.body,
                graphicsRoot,
                containerWidth, containerHeight,

                // Pack circle coordinates into array:
                //  cx, cy, radius
                circleLocation = new Float32Array(7),
                hairBuffer = new Float32Array(300000), // TODO: grow dynamically

                // Shaders definition
                //  Background sphere:
                circleFS = [
                        'precision mediump float;',
                        'varying vec4 vColor;',

                        'void main(void) {',
                        '   // Make it circle: ',
                        '   if ((gl_PointCoord.x - 0.5) * (gl_PointCoord.x - 0.5) + (gl_PointCoord.y - 0.5) * (gl_PointCoord.y - 0.5) < 0.25) {',
                        '       gl_FragColor = vec4(vColor);',
                        '   } else {',
                        '       gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);',
                        '   }',
                        '}'].join('\n'),
                circleVS = [
                        'attribute vec3 aSphereCoordinates;',
                        'attribute vec4 aSphereColor;',
                        'uniform vec2 uScreenSize;',
                        'varying vec4 vColor;',

                        'void main(void) {',
                        '   gl_Position = vec4(aSphereCoordinates.xy * 2.0 / uScreenSize - vec2(1.0, -1.0), 0, 1);',
                        '   gl_PointSize = aSphereCoordinates.z * 2.0;',
                        '   vColor = aSphereColor;',
                        '}'].join('\n'),

                // Hair:
                hairFS = [
                        'precision mediump float;',
                        'varying vec4 vColor;',

                        'void main(void) {',
                        '   gl_FragColor = vColor;',
                        '}'].join('\n'),
                hairVS = [
                        'attribute vec2 aVertexPos;',
                        'attribute vec4 aColor;',
                        'uniform vec2 uScreenSize;',
                        'varying vec4 vColor;',

                        'void main(void) {',
                        '   gl_Position = vec4(aVertexPos * 2.0 / uScreenSize - vec2(1.0, -1.0), 0.0, 1.0);',
                        '   vColor = aColor;',
                        '}'].join('\n'),
                currentHair = 0,
                ELEMENTS_PER_HAIR = 12,

                // WebGL API:
                updateSize = function() {
                    // It cannot be 0, since Chrome throws exceptions in that case
                    graphicsRoot.width = containerWidth = Math.max(container.offsetWidth, 1);
                    graphicsRoot.height = containerHeight = Math.max(container.offsetHeight, 1);
                },

                gl = (function initGl() {
                    graphicsRoot = document.createElement("canvas");
                    container.appendChild(graphicsRoot);
                    updateSize();

                    var gl = graphicsRoot.getContext('experimental-webgl', {antialias : true});
                    gl.clearColor(0, 0, 0, 1);
                    gl.enable(gl.BLEND);
                    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                    return gl;
                })(),

                createProgram = function(vertexShader, fragmentShader) {
                    var program = gl.createProgram();
                    gl.attachShader(program, vertexShader);
                    gl.attachShader(program, fragmentShader);
                    gl.linkProgram(program);
                    if (!gl.getProgramParameter(program, gl.LINK_STATUS)){
                        var msg = gl.getShaderInfoLog(program);
                        alert(msg);
                        throw msg;
                    }

                    return program;
                },

                createShader = function(shaderText, type) {
                    var shader = gl.createShader(type);
                    gl.shaderSource(shader, shaderText);
                    gl.compileShader(shader);

                    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                        var msg = gl.getShaderInfoLog(shader);
                        alert(msg);
                        throw msg;
                    }

                    return shader;
                },

                sphereProgram = (function() {
                    var sphere = createProgram(
                                    createShader(circleVS, gl.VERTEX_SHADER),
                                    createShader(circleFS, gl.FRAGMENT_SHADER));

                    sphere.screenSize = gl.getUniformLocation(sphere, 'uScreenSize');
                    sphere.location = gl.getAttribLocation(sphere, 'aSphereCoordinates');
                    sphere.color = gl.getAttribLocation(sphere, 'aSphereColor');

                    sphere.locationBuffer = gl.createBuffer();

                    return sphere;
                })(),

                hairProgram = (function() {
                    var program = createProgram(
                                    createShader(hairVS, gl.VERTEX_SHADER),
                                    createShader(hairFS, gl.FRAGMENT_SHADER));

                    program.screenSize = gl.getUniformLocation(program, 'uScreenSize');
                    program.location = gl.getAttribLocation(program, 'aVertexPos');
                    program.color = gl.getAttribLocation(program, 'aColor');
                    program.locationBuffer = gl.createBuffer();

                    return program;
                })();

            return {
                drawLine : function(x0, y0, x1, y1, startColor, endColor) {

                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 0] = x0;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 1] = -y0;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 2] = startColor.r;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 3] = startColor.g;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 4] = startColor.b;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 5] = startColor.a;


                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 6] = x1;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 7] = -y1;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 8] = endColor.r;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 9] = endColor.g;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 10] = endColor.b;
                    hairBuffer[currentHair * ELEMENTS_PER_HAIR + 11] = endColor.a;

                    currentHair += 1;
                },

                drawCircle : function(centerX, centerY, sphereR, sphereColor) {
                    circleLocation[0] = centerX;
                    circleLocation[1] = -centerY;
                    circleLocation[2] = sphereR;

                    // color:
                    circleLocation[3] = sphereColor.r;
                    circleLocation[4] = sphereColor.g;
                    circleLocation[5] = sphereColor.b;
                    circleLocation[6] = sphereColor.a;
                },

                beginRender : function() {
                    currentHair = 0;
                },

                endRender : function() {
                    console.log(currentHair);
                    updateSize();
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    // render background circle

                    gl.useProgram(sphereProgram);
                    gl.uniform2f(sphereProgram.screenSize, containerWidth, containerHeight);

                    gl.useProgram(sphereProgram);

                    gl.bindBuffer(gl.ARRAY_BUFFER, sphereProgram.locationBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, circleLocation, gl.STATIC_DRAW);

                    gl.enableVertexAttribArray(sphereProgram.location);
                    gl.vertexAttribPointer(sphereProgram.location, 3, gl.FLOAT, false, 0, 0);

                    gl.enableVertexAttribArray(sphereProgram.color);
                    gl.vertexAttribPointer(sphereProgram.color, 4, gl.FLOAT, false, 0, 3 * Float32Array.BYTES_PER_ELEMENT);

                    gl.drawArrays(gl.POINTS, 0, 1);


                    // render hair
                    gl.useProgram(hairProgram);
                    gl.uniform2f(hairProgram.screenSize, containerWidth, containerHeight);

                    gl.bindBuffer(gl.ARRAY_BUFFER, hairProgram.locationBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, hairBuffer, gl.DYNAMIC_DRAW);
                    //gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0.0, 200, -200, 1.0]), gl.DYNAMIC_DRAW);

                    gl.enableVertexAttribArray(hairProgram.location);
                    gl.vertexAttribPointer(hairProgram.location, 2, gl.FLOAT, false, 6 * 4, 0);

                    gl.enableVertexAttribArray(hairProgram.color);
                    gl.vertexAttribPointer(hairProgram.color, 4, gl.FLOAT, false, 6 * 4, 2 * 4);


                    //gl.drawArrays(gl.LINES, 0, 2);
                    gl.drawArrays(gl.LINES, 0, (currentHair - 1)*2);

                },

                width : document.body.offsetWidth,
                height: document.body.offsetHeight
            };
        };


        var ball = marimo(webglGraphics()),
            y = ball.centerY(),
            g = ball.gravity(),
            frameNumber = 0,
            inc = 1,
            time = 50,
            ease = 0.1,
            easingFunc = function(t, b, c, d) {
                t /= d/2.;
                if (t < 1) return c/2*t*t + b;
                t--;
                return -c/2 * (t*(t-2) - 1) + b;
            },
            animate = function() {
                requestAnimationFrame(animate);
                ball.render();
                ball.centerY(y/3 + 100 * ease);
                ball.gravity(-g * ease);
                ease = easingFunc(frameNumber, 0, 2, time);

                if (frameNumber >= time) {
                    inc = -1;
                } else if (frameNumber <= 0) {
                    inc = 1;
                }
                frameNumber = frameNumber + inc;
            };
        animate();
}

loaded();
