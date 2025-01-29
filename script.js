document.addEventListener("DOMContentLoaded", () => {
    const buttons = {
        forward: document.getElementById("forward"),
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
    let activeInterval = null; // ใช้สำหรับควบคุมการส่งซ้ำ
    let controlState = { forward: 0, backward: 0, left: 0, right: 0 }; // เก็บสถานะการเคลื่อนไหว
    let lastPublishedState = { ...controlState }; // เก็บสถานะล่าสุดที่ส่งออกไป

    // เชื่อมต่อ MQTT Broker
    const client = mqtt.connect("wss://mqttlocal.roverautonomous.com:443/mqtt", {
        username: "rover",
        password: "rover",
    });

    client.on("connect", () => {
        console.log("MQTT Connected");
        statusText.textContent = "MQTT CONNECTED";
        statusText.style.color = "green";
    });

    client.on("error", (err) => {
        console.error("MQTT Connection Error:", err);
        statusText.textContent = "DISCONNECT";
        statusText.style.color = "red";
    });

    // ฟังก์ชันส่งคำสั่ง MQTT ในรูปแบบ JSON
// ฟังก์ชันส่งคำสั่ง MQTT ในรูปแบบ JSON
function publishControlState() {
    if (JSON.stringify(controlState) !== JSON.stringify(lastPublishedState)) {
        const formattedJSON = JSON.stringify(controlState, null, 4); // จัดรูปแบบ JSON
        console.log(`[DEBUG] Publishing to Topic "rover/joystick":\n${formattedJSON}`);
        // ส่งข้อมูล JSON ไปยัง Topic rover/joystick
        client.publish("rover/joystick", formattedJSON);
        lastPublishedState = { ...controlState }; // บันทึกสถานะล่าสุด
    }
}

    // ฟังก์ชันเริ่มเคลื่อนไหว
    function startMoving(direction) {
        if (isStopped) {
            console.log("Cannot move while in Stop mode!");
            return;
        }

        // ตั้งค่า controlState
        const updatedState = { forward: 0, backward: 0, left: 0, right: 0 };
        updatedState[direction] = 1;

        if (JSON.stringify(controlState) !== JSON.stringify(updatedState)) {
            controlState = updatedState;
            publishControlState(); // ส่งคำสั่งเริ่มต้น
        }

        // ส่งซ้ำเมื่อกดค้าง
        if (!activeInterval) {
            activeInterval = setInterval(() => {
                const formattedJSON = JSON.stringify(controlState, null, 4); // จัดรูปแบบ JSON
                client.publish("rover/joystick", formattedJSON);
                console.log(`[DEBUG] Repeating:\n${formattedJSON}`);
            }, 100); // ส่งซ้ำทุก 100ms
        }
    }

    // ฟังก์ชันหยุดเคลื่อนไหว
    function stopMoving() {
        const updatedState = { forward: 0, backward: 0, left: 0, right: 0 };

        if (JSON.stringify(controlState) !== JSON.stringify(updatedState)) {
            controlState = updatedState;
            publishControlState();
        }

        // หยุดส่งซ้ำ
        if (activeInterval) {
            clearInterval(activeInterval);
            activeInterval = null;
        }
    }

    // ฟังก์ชันสลับโหมด
    function toggleMode() {
        isStopped = !isStopped;
        const mode = isStopped ? "STOP" : "START";
        toggleModeButton.textContent = mode;
        toggleModeButton.style.backgroundColor = isStopped ? "#ff0000" : "#00acff";
        console.log(`[MQTT] Mode: ${mode}`);
        stopMoving(); // หยุดการส่งคำสั่งเมื่อเปลี่ยนโหมด
    }

    // เปิดใช้งานปุ่มควบคุม
    function enableButtonControls() {
        Object.keys(buttons).forEach((key) => {
            const button = buttons[key];

            button.addEventListener("mousedown", () => {
                startMoving(key);
                button.style.backgroundColor = "#00b300";
            });

            button.addEventListener("mouseup", () => {
                stopMoving();
                button.style.backgroundColor = "#000000";
            });

            button.addEventListener("touchstart", () => {
                startMoving(key);
                button.style.backgroundColor = "#00b300";
            }, { passive: true });

            button.addEventListener("touchend", () => {
                stopMoving();
                button.style.backgroundColor = "#000000";
            }, { passive: true });
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
                const newControlState = { forward: 0, backward: 0, left: 0, right: 0 };

                if (!isStopped) {
                    if (gamepad.buttons[3]?.pressed) newControlState.forward = 1;
                    else if (gamepad.buttons[0]?.pressed) newControlState.backward = 1;
                    else if (gamepad.buttons[14]?.pressed) newControlState.left = 1;
                    else if (gamepad.buttons[15]?.pressed) newControlState.right = 1;
                }

                if (JSON.stringify(controlState) !== JSON.stringify(newControlState)) {
                    controlState = newControlState;
                    publishControlState();
                }
            }
        }
        requestAnimationFrame(pollGamepad);
    }

    // เพิ่ม Event Listener ให้ปุ่มใน UI
    toggleModeButton.addEventListener("click", toggleMode);

    // เปิดใช้งานปุ่ม UI
    enableButtonControls();

    // เริ่มตรวจจับ Gamepad
    pollGamepad();
});
