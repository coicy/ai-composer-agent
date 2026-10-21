import {createAgentServer} from './routes/server.js';
const host='127.0.0.1',port=Number(process.env.AGENT_API_PORT??'8787');
if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('invalid_agent_api_port');
createAgentServer({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL??'gpt-4.1-mini',allowedOrigin:process.env.WEB_ORIGIN??'http://localhost:5173'}).listen(port,host,()=>console.log(`Agent API listening at http://${host}:${port} (key ${process.env.OPENAI_API_KEY?'configured':'missing'})`));
