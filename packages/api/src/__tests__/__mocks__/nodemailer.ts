const createTransport = () => ({
  sendMail: async () => ({ messageId: 'mock' }),
});

export default { createTransport };
