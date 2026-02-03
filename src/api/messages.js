const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth');

// Mock database
const messages = [
  { id: 1, type: 'contactUs', content: 'How can we help you?', isRead: false },
  { id: 2, type: 'orderUpdates', content: 'Your order has been shipped.', isRead: false },
  { id: 3, type: 'promotions', content: '50% off on all items!', isRead: true },
];

// Get messages by type
router.get('/:type', (req, res) => {
  const { type } = req.params;
  const filteredMessages = messages.filter((msg) => msg.type === type);
  res.json(filteredMessages);
});

// Mark message as read
router.post('/:id/read', (req, res) => {
  const { id } = req.params;
  const message = messages.find((msg) => msg.id === parseInt(id));
  if (message) {
    message.isRead = true;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

// Apply authentication middleware
router.use(authMiddleware);

module.exports = router;