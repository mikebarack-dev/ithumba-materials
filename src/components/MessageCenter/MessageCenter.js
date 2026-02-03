import React, { useState, useEffect } from 'react';
import { fetchMessages, markMessageAsRead } from '../../services/api';
import './MessageCenter.css';

const MessageCenter = () => {
  const [activeTab, setActiveTab] = useState('contactUs');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const loadMessages = async () => {
      const fetchedMessages = await fetchMessages(activeTab);
      setMessages(fetchedMessages);
    };
    loadMessages();
  }, [activeTab]);

  const handleMarkAsRead = async (id) => {
    await markMessageAsRead(id);
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === id ? { ...msg, isRead: true } : msg
      )
    );
  };

  const renderContent = () => {
    if (messages.length === 0) {
      return <div>No messages available.</div>;
    }
    return (
      <ul>
        {messages.map((msg) => (
          <li key={msg.id} onClick={() => handleMarkAsRead(msg.id)}>
            {msg.content} {msg.isRead ? '' : <strong>(Unread)</strong>}
          </li>
        ))}
      </ul>
    );
  };

  const tabs = [
    { id: 'contactUs', label: 'Contact Us', unreadCount: 2 },
    { id: 'orderQuery', label: 'Order Query', unreadCount: 0 },
    { id: 'systemMessages', label: 'System Messages', unreadCount: 5 },
    { id: 'orderUpdates', label: 'Order Updates', unreadCount: 1 },
    { id: 'promotions', label: 'Promotions', unreadCount: 3 },
    { id: 'comments', label: 'Comments', unreadCount: 0 },
    { id: 'chatsWithSellers', label: 'Chats with Sellers', unreadCount: 4 },
  ];

  return (
    <div className="message-center">
      <div className="tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.unreadCount > 0 && <span className="badge">{tab.unreadCount}</span>}
          </div>
        ))}
      </div>
      <div className="content">
        {renderContent()}
      </div>
    </div>
  );
};

export default MessageCenter;