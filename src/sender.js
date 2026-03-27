function createSender(client) {
  async function isRegistered(phone) {
    return client.isRegisteredUser(phone + '@c.us');
  }

  async function sendMessage(phone, message) {
    return client.sendMessage(phone + '@c.us', message);
  }

  return { isRegistered, sendMessage };
}

module.exports = { createSender };
