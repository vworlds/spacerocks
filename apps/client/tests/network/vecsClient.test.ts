import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createMockClientWorld() {
  let disconnectHandler: (() => void) | undefined;

  return {
    addPhase: vi.fn((name: string) => name),
    installSystems: vi.fn(),
    start: vi.fn(),
    onDisconnect: vi.fn((handler: () => void) => {
      disconnectHandler = handler;
    }),
    setInput: vi.fn(),
    progress: vi.fn(),
    clearAllEntities: vi.fn(),
    disconnect: () => disconnectHandler?.(),
  };
}

type MockClientWorld = ReturnType<typeof createMockClientWorld>;

const mockState = vi.hoisted(() => ({
  clients: [] as MockClientWorld[],
  connectDgram: vi.fn(),
}));

vi.mock('@vworlds/vecs-client', () => ({
  ClientWorld: {
    connectDgram: mockState.connectDgram,
  },
}));

describe('vecs client connection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    mockState.clients = [];
    mockState.connectDgram.mockImplementation(async () => {
      const client = createMockClientWorld();
      mockState.clients.push(client);
      return client;
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ticks the network client independently from the render loop', async () => {
    const { connectVecsClient, tickVecsClient } =
      await import('@src/network/vecsClient');

    await connectVecsClient();
    const client = mockState.clients[0]!;

    expect(client.installSystems).toHaveBeenCalledWith({
      applyPhase: 'apply',
      sendPhase: 'send',
    });
    expect(client.progress).toHaveBeenCalledTimes(1);

    const input = {
      thrust: true,
      rotateLeft: false,
      rotateRight: true,
      shoot: true,
    };
    tickVecsClient(input, 100, 16);
    vi.advanceTimersByTime(17);

    expect(client.setInput).toHaveBeenLastCalledWith(input);
    expect(client.progress).toHaveBeenCalledTimes(2);
  });

  it('stops the network ticker when the client disconnects', async () => {
    const { connectVecsClient } = await import('@src/network/vecsClient');

    await connectVecsClient();
    const client = mockState.clients[0]!;
    client.disconnect();
    vi.advanceTimersByTime(50);

    expect(client.clearAllEntities).toHaveBeenCalledOnce();
    expect(client.progress).toHaveBeenCalledTimes(1);
  });
});
