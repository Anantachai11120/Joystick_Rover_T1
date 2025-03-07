document.addEventListener("DOMContentLoaded", () => {
    const buttons = {
        forward: document.getElementById("forward"),
        left: document.getElementById("left"),
        right: document.getElementById("right"),
        backward: document.getElementById("backward"),
    };

    const statusText = document.getElementById("connection-status");
    const toggleModeButton = document.getElementById("toggle-mode");
    const toggleAutoManualButton = document.getElementById("toggle-auto-manual"); // ปุ่ม Auto/Manual

    statusText.textContent = "DISCONNECT";
    statusText.style.color = "red";

    let gamepadIndex = null;
    let isStopped = true;
    let isAutoMode = false; // เริ่มต้นเป็น Manual Mode
    let activeInterval = null;
    let controlState = { forward: 0, backward: 0, left: 0, right: 0 };
    let lastPublishedState = { ...controlState };

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

    // ฟังก์ชันส่งคำสั่ง MQTT
    function publishControlState() {
        if (JSON.stringify(controlState) !== JSON.stringify(lastPublishedState)) {
            const formattedJSON = JSON.stringify(controlState, null, 4);
            console.log(`[DEBUG] Publishing to Topic "rover/joystick":\n${formattedJSON}`);
            client.publish("rover/joystick", formattedJSON);
            lastPublishedState = { ...controlState };
        }
    }

    // ฟังก์ชันเริ่มเคลื่อนไหว
    function startMoving(direction) {
        if (isStopped || isAutoMode) {
            console.log("Cannot move while in Stop mode or Auto mode!");
            return;
        }

        const updatedState = { forward: 0, backward: 0, left: 0, right: 0 };
        updatedState[direction] = 1;

        if (JSON.stringify(controlState) !== JSON.stringify(updatedState)) {
            controlState = updatedState;
            publishControlState();
        }

        if (!activeInterval) {
            activeInterval = setInterval(() => {
                const formattedJSON = JSON.stringify(controlState, null, 4);
                client.publish("rover/joystick", formattedJSON);
                console.log(`[DEBUG] Repeating:\n${formattedJSON}`);
            }, 100);
        }
    }

    // ฟังก์ชันหยุดเคลื่อนไหว
    function stopMoving() {
        const updatedState = { forward: 0, backward: 0, left: 0, right: 0 };

        if (JSON.stringify(controlState) !== JSON.stringify(updatedState)) {
            controlState = updatedState;
            publishControlState();
        }

        if (activeInterval) {
            clearInterval(activeInterval);
            activeInterval = null;
        }
    }

    // ฟังก์ชันสลับโหมด Stop/Start
    function toggleMode() {
        if (isAutoMode) {
            console.log("Cannot toggle mode while in Auto mode!");
            return;
        }

        isStopped = !isStopped;
        const mode = isStopped ? "STOP" : "START";
        toggleModeButton.textContent = mode;
        toggleModeButton.style.backgroundColor = isStopped ? "#ff0000" : "#00acff";
        console.log(`[MQTT] Mode: ${mode}`);
        stopMoving();
    }

    // ฟังก์ชันสลับโหมด Auto/Manual
function toggleAutoManualMode() {
    isAutoMode = !isAutoMode;

    if (isAutoMode) {
        toggleAutoManualButton.textContent = "AUTO";
        toggleAutoManualButton.style.backgroundColor = "#007bff"; // สีฟ้า
        disableControlButtons();
        console.log("[MQTT] Switching to AUTO mode");
        
        const message = '"auto"'; // ข้อความที่ต้องการส่ง
        client.publish("rover/statusauto", message);
        console.log(`[DEBUG] Published to "rover/statusauto": ${message}`); // ✅ แสดงในคอนโซล
    } else {
        toggleAutoManualButton.textContent = "MANUAL";
        toggleAutoManualButton.style.backgroundColor = "#28a745"; // สีเขียว
        enableControlButtons();
        console.log("[MQTT] Switching to MANUAL mode");

        const message = '"manual"'; // ข้อความที่ต้องการส่ง
        client.publish("rover/statusauto", message);
        console.log(`[DEBUG] Published to "rover/statusauto": ${message}`); // ✅ แสดงในคอนโซล
    }
}

    // ปิดการใช้งานปุ่มควบคุม
    function disableControlButtons() {
        Object.values(buttons).forEach(button => {
            button.disabled = true;
            button.style.opacity = "0.5";
        });
    }

    // เปิดการใช้งานปุ่มควบคุม
    function enableControlButtons() {
        Object.values(buttons).forEach(button => {
            button.disabled = false;
            button.style.opacity = "1";
        });
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

    // เพิ่ม Event Listener ให้ปุ่ม
    toggleModeButton.addEventListener("click", toggleMode);
    toggleAutoManualButton.addEventListener("click", toggleAutoManualMode);

    enableButtonControls();
});
