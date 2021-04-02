const httpServer = require('http').createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
});

const io = require('socket.io')(httpServer, {
  transport: ['websocket'],
  path: '/ws',
});
const Docker = require('dockerode');

const docker = new Docker();

const EXAMPLE_CONTAINER_NAME = 'XTERM_DOCKER_EXAMPLE';
const EXAMPLE_IMAGE = 'debian';
const streamMap = new Map();

run();

async function run() {
  const container = await ensureExampleContainerRun();

  io.on('connection', (socket) => {
    socket.on('start', async () => {
      const exec = await createContainerExec(container);
      exec.start({ hijack: true, stdin: true, Tty: true }, (err, stream) => {
        if (err) return;
        streamMap.set(socket.id, stream);

        stream.on('data', (data) => {
          socket.emit('output', data.toString('utf8'));
        });
      });
    });

    socket.on('input', (data) => {
      const stream = streamMap.get(socket.id);
      if (!stream) return;
      stream.write(data);
    });
  });

  httpServer.listen(7999);
}

async function ensureExampleContainerRun() {
  const containers = await listContainers();

  const cinfo = containers.find((c) =>
    c.Names.includes(`/${EXAMPLE_CONTAINER_NAME}`),
  );

  let container;

  if (!cinfo) {
    container = await docker.createContainer({
      name: EXAMPLE_CONTAINER_NAME,
      Image: EXAMPLE_IMAGE,
      Tty: true,
    });
  } else {
    container = docker.getContainer(cinfo.Id);
  }

  const stat = await container.inspect();
  if (!stat.State.Running) {
    await container.start();
  }

  return container;
}

function listContainers() {
  return new Promise((resolve, reject) => {
    docker.listContainers({ all: true }, (err, containers) => {
      if (err) {
        return reject(err);
      }
      resolve(containers);
    });
  });
}

function createContainerExec(container) {
  return new Promise((resolve, reject) => {
    container.exec(
      {
        Cmd: ['bash'],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
      },
      (err, exec) => {
        if (err) {
          return reject();
        }
        resolve(exec);
      },
    );
  });
}
