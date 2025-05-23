// scanner.js

// ====== 定数定義 ======

// デバイスインスタンスパス
const VENDOR_ID = 0x2DD6;
const PRODUCT_ID = 0x26CA;

const CMD_START_SCAN = "\x02\x54\x0D"; //  読み取り開始コマンド(LED点灯)
const CMD_STOP_SCAN = "\x02\x55\x0D";  //   読み取り終了コマンド(LED消灯)
const BAUD_RATE = 115200;                    // ビットレート

// ====== グローバル変数 ======
let port;
let reader;
let readLoopPromise;
let pipeAbortController;
let pipeToPromise;

// ====== スキャン開始処理 ======
async function startScanning() {
    try {
        if (!port) {
            port = await navigator.serial.requestPort();
        }

        if (!port.readable) {
            await port.open({ baudRate: BAUD_RATE });
            //await delay(100);
        }

        const writer = port.writable.getWriter();
        await writer.write(new TextEncoder().encode(CMD_START_SCAN));
        writer.releaseLock();

        if (!readLoopPromise) {
            readLoopPromise = readLoop();
        }

    } catch (err) {
        if (err.name === "NotFoundError") {
            console.log("ユーザーがポート選択をキャンセルしました");
        } else {
            console.error("接続エラー:", err);
        }
    }
}

// ====== スキャン停止処理 ======
async function stopScanning() {
    if (!port || !port.writable) {
        console.warn("ポートが開かれていません");
        return;
    }

    try {
        const writer = port.writable.getWriter();
        await writer.write(new TextEncoder().encode(CMD_STOP_SCAN));
        writer.releaseLock();
        console.log("読み取り停止コマンドを送信しました");

        pipeAbortController.abort();
        await pipeToPromise;

        await port.close();
        readLoopPromise = null;
        console.log("ポートを閉じました");

    } catch (err) {
        console.error("停止処理エラー:", err);
    }
}

// ====== 読み取りループ ======
async function readLoop() {
    const decoder = new TextDecoderStream();
    pipeAbortController = new AbortController();

    pipeToPromise = port.readable.pipeTo(decoder.writable, {
        signal: pipeAbortController.signal
    }).catch(e => {
        if (e.name === "AbortError") {
            console.log("パイプ接続が中断されました（正常）");
        } else {
            console.warn("パイプ切断:", e);
        }
    });

    reader = decoder.readable.getReader();

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            document.getElementById("result").textContent = value.trim();
        }
    } catch (error) {
        if (error.name === "AbortError") {
            console.log("読み取り処理が中断されました（正常）");
        } else {
            console.error("読み取りエラー:", error);
        }
    } finally {
        await reader.releaseLock();
    }
}

// ====== 自動接続 ======
async function autoConnectIfPossible() {
    const ports = await navigator.serial.getPorts();
    const targetPort = ports.find(p => {
        const info = p.getInfo();
        return info.usbVendorId === VENDOR_ID && info.usbProductId === PRODUCT_ID;
    });

    if (targetPort) {
        try {
            await targetPort.open({ baudRate: BAUD_RATE });
            port = targetPort;
            console.log("スキャナに自動接続しました");
        } catch (err) {
            console.error("スキャナ接続エラー:", err);
        }
    } else {
        console.log("指定されたスキャナが見つかりませんでした");
    }
}

// ====== 起動時に自動接続を試行 ======
window.addEventListener('DOMContentLoaded', () => {
    autoConnectIfPossible();
});
