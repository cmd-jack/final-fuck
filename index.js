const { Web3 } = require('web3');

const CONTRACT_ADDRESS = '0xD13dEaBdb1cEc48FA5Bd299cC2138Bd933ba9862';
const RPC_URL = 'https://alfajores-forno.celo-testnet.org';
const REQUIRED_PAYMENT = '0.001'; // 0.001 CELO

const CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
        "name": "getPayment",
        "outputs": [
            {"internalType": "address", "name": "", "type": "address"},
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "bool", "name": "", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getPaymentCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "PAYMENT_AMOUNT",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "address", "name": "sender", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "paymentId", "type": "uint256"}
        ],
        "name": "PaymentReceived",
        "type": "event"
    }
];

const web3 = new Web3(RPC_URL);
const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

let lastProcessedPayment = -1;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.url === '/api/check-payment') {
            const paymentCount = await contract.methods.getPaymentCount().call();
            const count = Number(paymentCount);
            
            if (count > lastProcessedPayment + 1) {
                const latestPaymentIndex = count - 1;
                const payment = await contract.methods.getPayment(latestPaymentIndex).call();
                
                if (!payment[3]) {
                    lastProcessedPayment = latestPaymentIndex;
                    
                    return res.status(200).json({
                        newPayment: true,
                        paymentId: latestPaymentIndex,
                        sender: payment[0],
                        amount: web3.utils.fromWei(payment[1].toString(), 'ether'),
                        timestamp: Number(payment[2])
                    });
                }
            }
            
            return res.status(200).json({ newPayment: false });
        }
        
        else if (req.url === '/api/transactions' || req.url === '/') {
            const paymentCount = await contract.methods.getPaymentCount().call();
            const count = Number(paymentCount);
            const payments = [];
            
            for (let i = 0; i < count; i++) {
                const payment = await contract.methods.getPayment(i).call();
                payments.push({
                    id: i,
                    sender: payment[0],
                    amount: web3.utils.fromWei(payment[1].toString(), 'ether'),
                    timestamp: new Date(Number(payment[2]) * 1000).toLocaleString(),
                    processed: payment[3]
                });
            }
            
            if (req.url === '/') {
                const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Payment Dashboard</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            min-height: 100vh;
                            padding: 20px;
                        }
                        .container {
                            max-width: 1200px;
                            margin: 0 auto;
                        }
                        h1 {
                            text-align: center;
                            margin-bottom: 30px;
                            font-size: 2.5em;
                            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                        }
                        .info-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        .info-card {
                            background: rgba(255,255,255,0.15);
                            padding: 20px;
                            border-radius: 15px;
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255,255,255,0.2);
                        }
                        .info-card h3 {
                            font-size: 0.9em;
                            opacity: 0.8;
                            margin-bottom: 8px;
                        }
                        .info-card p {
                            font-size: 1.3em;
                            font-weight: bold;
                        }
                        .required-amount {
                            background: rgba(76, 175, 80, 0.3);
                            border: 2px solid #4CAF50;
                        }
                        .table-container {
                            background: rgba(255,255,255,0.95);
                            border-radius: 15px;
                            overflow: hidden;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            color: #333;
                        }
                        th {
                            background: #667eea;
                            color: white;
                            padding: 18px 15px;
                            text-align: left;
                            font-weight: 600;
                            font-size: 0.95em;
                        }
                        td {
                            padding: 15px;
                            border-bottom: 1px solid #e0e0e0;
                        }
                        tr:hover {
                            background: rgba(102, 126, 234, 0.08);
                        }
                        tr:last-child td {
                            border-bottom: none;
                        }
                        .status {
                            padding: 6px 12px;
                            border-radius: 20px;
                            font-weight: bold;
                            font-size: 0.85em;
                            display: inline-block;
                        }
                        .processed {
                            background: #4CAF50;
                            color: white;
                        }
                        .pending {
                            background: #FF9800;
                            color: white;
                        }
                        .no-data {
                            text-align: center;
                            padding: 40px;
                            color: #666;
                            font-style: italic;
                        }
                        @media (max-width: 768px) {
                            h1 {
                                font-size: 1.8em;
                            }
                            table {
                                font-size: 0.85em;
                            }
                            th, td {
                                padding: 10px 8px;
                            }
                        }
                    </style>
                    <script>
                        setInterval(() => {
                            location.reload();
                        }, 5000);
                    </script>
                </head>
                <body>
                    <div class="container">
                        <h1>🔐 Celo Payment Dashboard</h1>
                        <div class="info-grid">
                            <div class="info-card required-amount">
                                <h3>Required Payment</h3>
                                <p>${REQUIRED_PAYMENT} CELO</p>
                            </div>
                            <div class="info-card">
                                <h3>Total Payments</h3>
                                <p>${count}</p>
                            </div>
                            <div class="info-card">
                                <h3>Network</h3>
                                <p>Alfajores Testnet</p>
                            </div>
                            <div class="info-card">
                                <h3>Contract Address</h3>
                                <p style="font-size: 0.85em; word-break: break-all;">${CONTRACT_ADDRESS.substring(0, 10)}...${CONTRACT_ADDRESS.substring(CONTRACT_ADDRESS.length - 8)}</p>
                            </div>
                        </div>
                        <div class="table-container">
                            ${count > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Sender</th>
                                        <th>Amount (CELO)</th>
                                        <th>Time</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.reverse().map(p => `
                                        <tr>
                                            <td><strong>#${p.id}</strong></td>
                                            <td>${p.sender.substring(0, 10)}...${p.sender.substring(p.sender.length - 6)}</td>
                                            <td><strong>${p.amount}</strong></td>
                                            <td>${p.timestamp}</td>
                                            <td><span class="status ${p.processed ? 'processed' : 'pending'}">${p.processed ? '✓ Processed' : '⏳ Pending'}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            ` : '<div class="no-data">No payments received yet. Send 0.001 CELO to get started!</div>'}
                        </div>
                    </div>
                </body>
                </html>
                `;
                
                return res.status(200).send(html);
            }
            
            return res.status(200).json({ count, payments, requiredAmount: REQUIRED_PAYMENT });
        }
        
        else {
            return res.status(404).json({ error: 'Not found' });
        }
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
