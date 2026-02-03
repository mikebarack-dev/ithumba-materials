import axios from 'axios';

const API_BASE_URL = 'https://ithumbadhardware.com/api';

export const fetchMessages = async (type) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/messages/${type}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

export const markMessageAsRead = async (id) => {
  try {
    await axios.post(`${API_BASE_URL}/messages/${id}/read`);
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
};