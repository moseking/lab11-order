const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Environment variables for service URLs
const USER_SERVICE_URL =
    process.env.USER_SERVICE_URL || 'http://localhost:3001';

const PRODUCT_SERVICE_URL =
    process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

// In-memory database
let orders = [];

// Get all orders
app.get('/orders', (req, res) => {
    res.json(orders);
});

// Get order by ID
app.get('/orders/:id', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.id));

    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
});

// Create new order
app.post('/orders', async (req, res) => {
    try {
        const { userId, productId, quantity } = req.body;

        console.log(
            `Creating order: userId=${userId}, productId=${productId}, quantity=${quantity}`
        );

        // Verify user exists
        try {
            const userResponse = await axios.get(
                `${USER_SERVICE_URL}/users/${userId}`,
                { timeout: 5000 }
            );

            console.log('User verified:', userResponse.data);
        } catch (error) {
            console.error('User verification failed:', error.message);

            return res.status(400).json({
                error: 'Invalid user or user service unavailable'
            });
        }

        // Verify product and check stock
        let product;

        try {
            const productResponse = await axios.get(
                `${PRODUCT_SERVICE_URL}/products/${productId}`,
                { timeout: 5000 }
            );

            product = productResponse.data;
            console.log('Product verified:', product);
        } catch (error) {
            console.error('Product verification failed:', error.message);

            return res.status(400).json({
                error: 'Invalid product or product service unavailable'
            });
        }

        if (product.stock < quantity) {
            return res.status(400).json({
                error: 'Insufficient stock'
            });
        }

        // Update product stock
        try {
            await axios.patch(
                `${PRODUCT_SERVICE_URL}/products/${productId}/stock`,
                { quantity },
                { timeout: 5000 }
            );

            console.log('Stock updated successfully');
        } catch (error) {
            console.error('Stock update failed:', error.message);

            return res.status(500).json({
                error: 'Failed to update product stock'
            });
        }

        // Create order
        const newOrder = {
            id: orders.length + 1,
            userId: parseInt(userId),
            productId: parseInt(productId),
            quantity: parseInt(quantity),
            totalPrice: product.price * quantity,
            status: 'completed',
            createdAt: new Date().toISOString()
        };

        orders.push(newOrder);

        console.log('Order created:', newOrder);
        res.status(201).json(newOrder);

    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        service: 'order-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        dependencies: {
            userService: USER_SERVICE_URL,
            productService: PRODUCT_SERVICE_URL
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Order Service',
        version: '1.0.0',
        endpoints: [
            'GET /orders - Get all orders',
            'GET /orders/:id - Get order by ID',
            'POST /orders - Create order',
            'GET /health - Health check'
        ],
        dependencies: {
            userService: USER_SERVICE_URL,
            productService: PRODUCT_SERVICE_URL
        }
    });
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
    console.log(`User Service URL: ${USER_SERVICE_URL}`);
    console.log(`Product Service URL: ${PRODUCT_SERVICE_URL}`);
});