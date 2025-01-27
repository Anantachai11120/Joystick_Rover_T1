document.addEventListener("DOMContentLoaded", () => {
    const buttons = {
        up: document.getElementById("up"),
        left: document.getElementById("left"),
        right: document.getElementById("right"),
        down: document.getElementById("down"),
    };

    const statusText = document.getElementById("connection-status");
    const toggleModeButton = document.getElementById("toggle-mode");

    statusText.textContent = "DISCONNECT";
    statusText.style.color = "red";

    let gamepadIndex = null;
    let isStopped = true; // เริ่มต้นในโหมด Stop
    let isModeToggled = false; // ใช้สำหรับตรวจจับปุ่ม Toggle Mode
    const activeIntervals = {}; // เก็บ Intervals ของปุ่มที่ถูกกด
    const pressedButtons = {}; // เก็บสถานะการกดของปุ่ม Gamepad

    // เชื่อมต่อ MQTT Broker
    const client = mqtt.connect("wss://mqtt.eclipseprojects.io:443/mqtt");

    client.on("connect", () => {
        console.log("MQTT Connected");
        statusText.textContent = "MQTT CONNECTED";
        statusText.style.color = "green";
        client.subscribe("rover/control", (err) => {
            if (err) {
                console.error("Failed to subscribe:", err);
            } else {
                console.log("Subscribed to topic: rover/control");
            }
        });
    });

    client.on("error", (err) => {
        console.error("MQTT Connection Error:", err);
        statusText.textContent = "DISCONNECT";
        statusText.style.color = "red";
    });

    // ฟังก์ชันสลับโหมด
    function toggleMode() {
        isStopped = !isStopped;
        const mode = isStopped ? "STOP" : "START";
        toggleModeButton.textContent = mode;
        toggleModeButton.style.backgroundColor = isStopped ? "#ff0000" : "#00acff";
        client.publish("rover/control", mode);
        console.log(`[MQTT] Published: ${mode}`);
    }

    // ฟังก์ชันเริ่มเคลื่อนที่แบบต่อเนื่อง
    function startMoving(direction) {
        if (isStopped) {
            console.log("Cannot move while in Stop mode!");
            return;
        }

        // เริ่มส่งคำสั่งแบบต่อเนื่องถ้ายังไม่มี Interval สำหรับปุ่มนี้
        if (!activeIntervals[direction]) {
            activeIntervals[direction] = setInterval(() => {
                client.publish("rover/control", direction.toUpperCase());
                console.log(`[MQTT] Published: ${direction.toUpperCase()}`);
            }, 100); // ส่งคำสั่งทุก 100ms
        }
    }

    // ฟังก์ชันหยุดการเคลื่อนที่ (ส่งคำสั่ง STOP)
    function stopMoving(direction) {
        if (activeIntervals[direction]) {
            clearInterval(activeIntervals[direction]); // หยุด Interval
            delete activeIntervals[direction]; // ลบออกจาก activeIntervals
        }

        // ส่งคำสั่ง STOP ทุกครั้งเมื่อปล่อยปุ่ม
        client.publish("rover/control", "STOP");
        console.log(`[MQTT] Published: STOP`);
    }

    // เปิดใช้งานปุ่มควบคุม
    function enableButtonControls() {
        Object.keys(buttons).forEach((key) => {
            const button = buttons[key];
    
            const startEvent = () => {
                startMoving(key);
                button.style.backgroundColor = "#00b300"; // เปลี่ยนสีปุ่มเมื่อกด
            };
    
            const endEvent = () => {
                stopMoving(key);
                button.style.backgroundColor = "#000000"; // กลับไปสีเริ่มต้นเมื่อปล่อยปุ่ม
            };
    
            // เพิ่ม Event Listeners ให้กับปุ่ม
            button.addEventListener("mousedown", startEvent);
            button.addEventListener("mouseup", endEvent);
            button.addEventListener("touchstart", startEvent, { passive: true });
            button.addEventListener("touchend", endEvent, { passive: true });
        });
    }   

    // ตรวจจับการเชื่อมต่อ Gamepad
    window.addEventListener("gamepadconnected", (event) => {
        gamepadIndex = event.gamepad.index;
        statusText.textContent = "GAMEPAD CONNECTED";
        statusText.style.color = "green";
        console.log("Gamepad connected:", event.gamepad);
    });

    // ตรวจจับการถอด Gamepad
    window.addEventListener("gamepaddisconnected", () => {
        gamepadIndex = null;
        statusText.textContent = "GAMEPAD DISCONNECTED";
        statusText.style.color = "red";
        console.log("Gamepad disconnected");
    });

    // ตรวจจับการกดปุ่ม Gamepad
    function pollGamepad() {
        const gamepads = navigator.getGamepads();
        if (gamepadIndex !== null && gamepads[gamepadIndex]) {
            const gamepad = gamepads[gamepadIndex];

            if (gamepad) {
                // ปุ่ม Forward
                if (gamepad.buttons[3]?.pressed) {
                    if (!pressedButtons["up"]) {
                        startMoving("up");
                        buttons.up.style.backgroundColor = "#00b300";
                        pressedButtons["up"] = true;
                    }
                } else if (pressedButtons["up"]) {
                    stopMoving("up");
                    buttons.up.style.backgroundColor = "#000000";
                    pressedButtons["up"] = false;
                }

                // ปุ่ม Backward
                if (gamepad.buttons[0]?.pressed) {
                    if (!pressedButtons["down"]) {
                        startMoving("down");
                        buttons.down.style.backgroundColor = "#00b300";
                        pressedButtons["down"] = true;
                    }
                } else if (pressedButtons["down"]) {
                    stopMoving("down");
                    buttons.down.style.backgroundColor = "#000000";
                    pressedButtons["down"] = false;
                }

                // ปุ่ม Left
                if (gamepad.buttons[14]?.pressed) {
                    if (!pressedButtons["left"]) {
                        startMoving("left");
                        buttons.left.style.backgroundColor = "#00b300";
                        pressedButtons["left"] = true;
                    }
                } else if (pressedButtons["left"]) {
                    stopMoving("left");
                    buttons.left.style.backgroundColor = "#000000";
                    pressedButtons["left"] = false;
                }

                // ปุ่ม Right
                if (gamepad.buttons[15]?.pressed) {
                    if (!pressedButtons["right"]) {
                        startMoving("right");
                        buttons.right.style.backgroundColor = "#00b300";
                        pressedButtons["right"] = true;
                    }
                } else if (pressedButtons["right"]) {
                    stopMoving("right");
                    buttons.right.style.backgroundColor = "#000000";
                    pressedButtons["right"] = false;
                }

                // ปุ่ม Toggle Mode
                if (gamepad.buttons[1]?.pressed) {
                    if (!isModeToggled) {
                        toggleMode();
                        isModeToggled = true;
                    }
                } else {
                    isModeToggled = false;
                }
            }
        }
        requestAnimationFrame(pollGamepad);
    }

    // เพิ่ม Event Listener ให้ปุ่มใน UI
    toggleModeButton.addEventListener("click", toggleMode);

    // เปิดใช้งานปุ่ม UI
    enableButtonControls();

    // ลงทะเบียน Service Worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").then(() => {
            console.log("Service Worker Registered");
        }).catch((err) => {
            console.error("Service Worker Registration Failed:", err);
        });
    }

    // เริ่มตรวจจับ Gamepad
    pollGamepad();
});
