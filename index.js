const express = require('express');
const dotenv = require('dotenv');
const { analizarTextoRecibo } = require('./servicioGemini');
const {guardarTicket } = require('./servicioBlobStorage');
const { textoAImagen } = require('./servicioComputerVision');
const multer = require('multer');

//Evitamos que se guarde en disco, así que solo se retiene en memoria RAM con solo almacenamiento volatil 
const storage = multer.memoryStorage();
const upload = multer( {storage: storage} );

dotenv.config();

const app = express();

const PORT = 3000;
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend funcionando');
});

app.post('/api/recibo/analizar', async (req, res) => {
  const { textoExtraido } = req.body;

  if (!textoExtraido || typeof textoExtraido !== 'string') {
    return res.status(400).json({ error: 'textoExtraido es requerido como string en el body.' });
  }

  try {
    const ticket = await analizarTextoRecibo(textoExtraido);
    return res.json(ticket);
  } catch (error) {
    console.error('Error analizando recibo:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servicio Gemini.' });
  }
});

//Endpoint que va a conectarse con el servicio de blob storage
app.post('/guardar-ticket', upload.single('ticket'), async(req, res) => {
  try {
    //La respuesta será un json
    console.log("Si estamos dentro de este servicio");
    //Recuperamos el nombre del recurso que se le va a otorgar en blob storage
    const blobName = req.file.originalname;
    //Recuperamos el buffer con los bytes de la imagen del ticket
    const ticketData = req.file.buffer;
    //Llamamos a la función que se encarga de manejar el servicio de blob storage
    const resultado = await guardarTicket(blobName, ticketData);
    //Validamos con el campo de value definido en la respuesta de la función que maneja blob storage
    if(resultado.value){
        console.log("El servicio de blob storage funciona correctamente");
        const analisisResponse = await textoAImagen(resultado.content);
        if(analisisResponse.value){
          console.log("Se realizo el analisis de forma correcta");
          const ticketProcesado = await analizarTextoRecibo(analisisResponse.textoExtraido);
          console.log("TICKET PROCESADO:");
          console.log(ticketProcesado);
          return res.send({
            value: true,
            ticket: ticketProcesado,
            textoExtraido: analisisResponse.textoExtraido
          });
        } else {
          return res.send({
            value: false,
            content: "No se pudo analizar el ticket"
          });
        }
      } else {
        return res.send({
          value: false,
          content: "No se pudo guardar el ticket"
        });
      }
    } catch(error){
      console.log(error);
      return res.status(500).send({
        value: false,
        error: error.message
      });
    }
  });

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});