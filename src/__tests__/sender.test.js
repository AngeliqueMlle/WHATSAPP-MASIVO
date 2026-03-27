const { createSender } = require('../sender');

const mockClient = {
  isRegisteredUser: jest.fn(),
  sendMessage: jest.fn()
};

beforeEach(() => jest.clearAllMocks());

test('isRegistered calls client with @c.us suffix', async () => {
  mockClient.isRegisteredUser.mockResolvedValue(true);
  const sender = createSender(mockClient);
  const result = await sender.isRegistered('51987654321');
  expect(result).toBe(true);
  expect(mockClient.isRegisteredUser).toHaveBeenCalledWith('51987654321@c.us');
});

test('isRegistered returns false when client returns false', async () => {
  mockClient.isRegisteredUser.mockResolvedValue(false);
  const sender = createSender(mockClient);
  expect(await sender.isRegistered('51987654321')).toBe(false);
});

test('sendMessage calls client with @c.us suffix and correct message', async () => {
  mockClient.sendMessage.mockResolvedValue({});
  const sender = createSender(mockClient);
  await sender.sendMessage('51987654321', 'Hola Juan');
  expect(mockClient.sendMessage).toHaveBeenCalledWith('51987654321@c.us', 'Hola Juan');
});
