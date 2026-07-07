window.spacerocksConnectionOptions = {
  host: window.location.hostname,
  port: 2567,
  protocol: window.location.protocol === 'https:' ? 'https' : 'http',
  worldName: 'main',
  apiBasePath: '/rtc/v1',
};