'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const net = require('net');
const { execSync, spawn } = require('child_process');

// ============================================================
// CONFIG
// ============================================================

// Port do Generic/Pterodactyl cấp
const PORT = String(
    process.env.SERVER_PORT ||
    process.env.PORT ||
    '20128'
);

// Bind
const HOST = '0.0.0.0';

// ============================================================
// 9ROUTER PASSWORD
// ============================================================
//
// Cách 1:
// Sửa trực tiếp dòng PASSWORD bên dưới.
//
// Cách 2:
// Tạo biến môi trường ROUTER_PASSWORD trên Panel.
//
// Ví dụ:
// ROUTER_PASSWORD=MyPassword123!
//
// ============================================================

const PASSWORD =
    process.env.ROUTER_PASSWORD ||
    'CHANGE_THIS_PASSWORD_123!';

// JWT secret
const JWT_SECRET =
    process.env.JWT_SECRET ||
    'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_9ROUTER';

// Data directory
const DATA_DIR =
    process.env.DATA_DIR ||
    path.join(process.cwd(), '.9router');

// Cloudflared
const CLOUDFLARED_DIR =
    path.join(process.cwd(), '.cloudflared');

const CLOUDFLARED_BIN =
    path.join(
        CLOUDFLARED_DIR,
        process.platform === 'win32'
            ? 'cloudflared.exe'
            : 'cloudflared'
    );

// ============================================================
// LOG
// ============================================================

function log(msg) {
    console.log(`[9Router] ${msg}`);
}

function error(msg) {
    console.error(`[ERROR] ${msg}`);
}

// ============================================================
// BANNER
// ============================================================

console.log('');
console.log('================================================');
console.log('        9ROUTER + CLOUDFLARE GENERIC');
console.log('================================================');
console.log(`Node       : ${process.version}`);
console.log(`OS         : ${process.platform}`);
console.log(`Arch       : ${process.arch}`);
console.log(`Host       : ${HOST}`);
console.log(`Port       : ${PORT}`);
console.log(`Data       : ${DATA_DIR}`);
console.log(`Password   : ${PASSWORD === 'CHANGE_THIS_PASSWORD_123!' ? 'CHƯA ĐỔI' : 'ĐÃ CẤU HÌNH'}`);
console.log('================================================');
console.log('');

// ============================================================
// NODE CHECK
// ============================================================

const nodeMajor =
    Number(process.versions.node.split('.')[0]);

if (nodeMajor < 20) {
    error(
        `Node.js ${process.version} không đủ yêu cầu.`
    );

    error(
        '9Router yêu cầu Node.js 20+.'
    );

    process.exit(1);
}

// ============================================================
// PASSWORD CHECK
// ============================================================

if (PASSWORD === 'CHANGE_THIS_PASSWORD_123!') {
    console.log('');
    console.log(
        '⚠️  CẢNH BÁO: Bạn chưa đổi PASSWORD trong start.js'
    );
    console.log('');
    console.log(
        'Hãy sửa:'
    );
    console.log('');
    console.log(
        "const PASSWORD = 'CHANGE_THIS_PASSWORD_123!';"
    );
    console.log('');
    console.log(
        'thành ví dụ:'
    );
    console.log('');
    console.log(
        "const PASSWORD = 'MyStrongPassword@2026!';"
    );
    console.log('');
}

// ============================================================
// ENVIRONMENT
// ============================================================

const env = {
    ...process.env,

    PORT: String(PORT),
    HOSTNAME: HOST,

    NODE_ENV:
        process.env.NODE_ENV ||
        'production',

    DATA_DIR,

    // 9Router authentication
    INITIAL_PASSWORD: PASSWORD,
    JWT_SECRET
};

// ============================================================
// CREATE DATA DIR
// ============================================================

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(
        DATA_DIR,
        {
            recursive: true
        }
    );

    log('Đã tạo DATA_DIR.');
}

// ============================================================
// CREATE PACKAGE.JSON
// ============================================================

const packageJson =
    path.join(
        process.cwd(),
        'package.json'
    );

if (!fs.existsSync(packageJson)) {

    fs.writeFileSync(
        packageJson,

        JSON.stringify(
            {
                name: '9router-generic',
                version: '1.0.0',
                private: true
            },

            null,

            2
        )
    );

    log('Đã tạo package.json.');
}

// ============================================================
// INSTALL 9ROUTER
// ============================================================

function install9Router() {

    log('Đang cài 9Router...');

    try {

        execSync(
            'npm install 9router@latest --no-audit --no-fund',
            {
                cwd: process.cwd(),
                stdio: 'inherit',
                env
            }
        );

        log(
            '9Router cài đặt thành công.'
        );

    } catch (e) {

        error(
            'Không thể cài 9Router.'
        );

        process.exit(1);
    }
}

// ============================================================
// CHECK 9ROUTER
// ============================================================

const routerPath =
    path.join(
        process.cwd(),
        'node_modules',
        '9router'
    );

if (!fs.existsSync(routerPath)) {

    install9Router();

} else {

    log(
        '9Router đã tồn tại.'
    );
}

// ============================================================
// WAIT PORT
// ============================================================

function waitForPort(
    port,
    host = '127.0.0.1',
    timeout = 120000
) {

    return new Promise(
        (resolve, reject) => {

            const start =
                Date.now();

            function check() {

                const socket =
                    new net.Socket();

                socket.setTimeout(1500);

                socket.once(
                    'connect',
                    () => {

                        socket.destroy();

                        resolve();
                    }
                );

                socket.once(
                    'error',
                    () => {

                        socket.destroy();

                        if (
                            Date.now() - start >
                            timeout
                        ) {

                            reject(
                                new Error(
                                    `Port ${port} không mở sau ${timeout / 1000}s`
                                )
                            );

                            return;
                        }

                        setTimeout(
                            check,
                            1000
                        );
                    }
                );

                socket.once(
                    'timeout',
                    () => {

                        socket.destroy();

                        setTimeout(
                            check,
                            1000
                        );
                    }
                );

                socket.connect(
                    port,
                    host
                );
            }

            check();
        }
    );
}

// ============================================================
// CLOUDFLARED DOWNLOAD
// ============================================================

function downloadFile(
    url,
    destination
) {

    return new Promise(
        (resolve, reject) => {

            const file =
                fs.createWriteStream(
                    destination
                );

            https.get(
                url,
                {
                    headers: {
                        'User-Agent':
                            '9router-generic'
                    }
                },

                response => {

                    // Redirect
                    if (
                        response.statusCode >= 300 &&
                        response.statusCode < 400 &&
                        response.headers.location
                    ) {

                        file.close();

                        try {
                            fs.unlinkSync(
                                destination
                            );
                        } catch {}

                        return downloadFile(
                            response.headers.location,
                            destination
                        )
                            .then(resolve)
                            .catch(reject);
                    }

                    if (
                        response.statusCode !== 200
                    ) {

                        file.close();

                        try {
                            fs.unlinkSync(
                                destination
                            );
                        } catch {}

                        reject(
                            new Error(
                                `HTTP ${response.statusCode}`
                            )
                        );

                        return;
                    }

                    response.pipe(file);

                    file.on(
                        'finish',
                        () => {

                            file.close(
                                resolve
                            );
                        }
                    );
                }
            )
            .on(
                'error',
                err => {

                    file.close();

                    try {
                        fs.unlinkSync(
                            destination
                        );
                    } catch {}

                    reject(err);
                }
            );
        }
    );
}

// ============================================================
// GITHUB RELEASE
// ============================================================

function getLatestCloudflared() {

    return new Promise(
        (resolve, reject) => {

            https.get(
                'https://api.github.com/repos/cloudflare/cloudflared/releases/latest',
                {
                    headers: {
                        'User-Agent':
                            '9router-generic',
                        'Accept':
                            'application/vnd.github+json'
                    }
                },

                response => {

                    let data = '';

                    response.on(
                        'data',
                        chunk => {
                            data += chunk;
                        }
                    );

                    response.on(
                        'end',
                        () => {

                            if (
                                response.statusCode !== 200
                            ) {

                                reject(
                                    new Error(
                                        `GitHub API HTTP ${response.statusCode}`
                                    )
                                );

                                return;
                            }

                            try {

                                resolve(
                                    JSON.parse(data)
                                );

                            } catch (e) {

                                reject(e);
                            }
                        }
                    );
                }
            )
            .on(
                'error',
                reject
            );
        }
    );
}

// ============================================================
// CLOUDLFARED ASSET
// ============================================================

function getCloudflaredAsset(
    release
) {

    if (
        process.platform !== 'linux'
    ) {

        throw new Error(
            'Script này dành cho Linux Generic/Pterodactyl.'
        );
    }

    let filename;

    switch (
        process.arch
    ) {

        case 'x64':
            filename =
                'cloudflared-linux-amd64';
            break;

        case 'arm64':
            filename =
                'cloudflared-linux-arm64';
            break;

        case 'arm':
            filename =
                'cloudflared-linux-arm';
            break;

        case 'ia32':
            filename =
                'cloudflared-linux-386';
            break;

        default:
            throw new Error(
                `Không hỗ trợ CPU: ${process.arch}`
            );
    }

    const asset =
        release.assets.find(
            x =>
                x.name === filename
        );

    if (!asset) {

        throw new Error(
            `Không tìm thấy ${filename}`
        );
    }

    return asset;
}

// ============================================================
// INSTALL CLOUDFLARED
// ============================================================

async function installCloudflared() {

    if (
        fs.existsSync(
            CLOUDFLARED_BIN
        )
    ) {

        try {

            fs.chmodSync(
                CLOUDFLARED_BIN,
                0o755
            );

        } catch {}

        log(
            'cloudflared đã tồn tại.'
        );

        return;
    }

    fs.mkdirSync(
        CLOUDFLARED_DIR,
        {
            recursive: true
        }
    );

    log(
        'Đang lấy cloudflared mới nhất...'
    );

    const release =
        await getLatestCloudflared();

    log(
        `Cloudflared ${release.tag_name}`
    );

    const asset =
        getCloudflaredAsset(
            release
        );

    log(
        `Đang tải ${asset.name}...`
    );

    await downloadFile(
        asset.browser_download_url,
        CLOUDFLARED_BIN
    );

    fs.chmodSync(
        CLOUDFLARED_BIN,
        0o755
    );

    log(
        'cloudflared đã cài xong.'
    );
}

// ============================================================
// START 9ROUTER
// ============================================================

function startRouter() {

    log(
        `Đang khởi động 9Router tại ${HOST}:${PORT}...`
    );

    console.log('');

    const command =
        process.platform === 'win32'
            ? 'npx.cmd'
            : 'npx';

    const router =
        spawn(
            command,

            [
                '--yes',
                '9router@latest',
                '--port',
                PORT,
                '--no-browser'
            ],

            {
                cwd: process.cwd(),

                env,

                stdio:
                    'inherit'
            }
        );

    router.on(
        'error',
        error => {

            err(
                `9Router error: ${error.message}`
            );

            process.exit(1);
        }
    );

    return router;
}

// ============================================================
// CLOUDFLARE URL FINDER
// ============================================================

function findCloudflareURL(
    text
) {

    const regex =
        /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g;

    const result =
        text.match(regex);

    return result
        ? result[0]
        : null;
}

// ============================================================
// START CLOUDFLARE TUNNEL
// ============================================================

function startCloudflare() {

    log(
        `Đang tạo Cloudflare Quick Tunnel -> localhost:${PORT}`
    );

    const tunnel =
        spawn(
            CLOUDFLARED_BIN,

            [
                'tunnel',
                '--no-autoupdate',
                '--url',
                `http://127.0.0.1:${PORT}`
            ],

            {
                cwd:
                    CLOUDFLARED_DIR,

                env: {
                    ...process.env
                },

                stdio: [
                    'ignore',
                    'pipe',
                    'pipe'
                ]
            }
        );

    let found =
        false;

    function output(
        data
    ) {

        const text =
            data.toString();

        process.stdout.write(
            `[Cloudflare] ${text}`
        );

        const url =
            findCloudflareURL(
                text
            );

        if (
            url &&
            !found
        ) {

            found =
                true;

            console.log('');
            console.log(
                '================================================'
            );
            console.log(
                '          CLOUDFLARE PUBLIC URL'
            );
            console.log(
                '================================================'
            );
            console.log(
                `PUBLIC : ${url}`
            );
            console.log(
                `API    : ${url}/v1`
            );
            console.log(
                `LOCAL  : http://127.0.0.1:${PORT}`
            );
            console.log(
                '================================================'
            );
            console.log('');
        }
    }

    tunnel.stdout.on(
        'data',
        output
    );

    tunnel.stderr.on(
        'data',
        output
    );

    tunnel.on(
        'error',
        e => {

            error(
                `Cloudflare: ${e.message}`
            );
        }
    );

    return tunnel;
}

// ============================================================
// MAIN
// ============================================================

let routerProcess = null;
let cloudflareProcess = null;

async function main() {

    try {

        // 1. Cloudflared
        await installCloudflared();

        // 2. 9Router
        routerProcess =
            startRouter();

        // 3. Chờ 9Router
        log(
            `Đang chờ port ${PORT}...`
        );

        await waitForPort(
            Number(PORT)
        );

        log(
            `9Router đã sẵn sàng.`
        );

        // 4. Cloudflare
        cloudflareProcess =
            startCloudflare();

    } catch (e) {

        error(
            e.message
        );

        shutdown();
    }
}

// ============================================================
// SHUTDOWN
// ============================================================

function shutdown() {

    console.log('');
    log(
        'Đang dừng server...'
    );

    try {

        if (
            cloudflareProcess &&
            !cloudflareProcess.killed
        ) {

            cloudflareProcess.kill(
                'SIGTERM'
            );
        }

    } catch {}

    try {

        if (
            routerProcess &&
            !routerProcess.killed
        ) {

            routerProcess.kill(
                'SIGTERM'
            );
        }

    } catch {}

    setTimeout(
        () => process.exit(0),
        2000
    );
}

process.on(
    'SIGINT',
    shutdown
);

process.on(
    'SIGTERM',
    shutdown
);

// ============================================================
// RUN
// ============================================================

main();
