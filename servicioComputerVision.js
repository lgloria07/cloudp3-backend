const createClient = require("@azure-rest/ai-vision-image-analysis").default;
//Se utiliza cuando vamos a necesitar autenticar dando el nombre del recurso y la apiKey
const { AzureNamedKeyCredential } = require("@azure/core-auth");
//Se utiliza cuando vamos a necesitar autenticar dando solo la apiKey
const { AzureKeyCredential } = require("@azure/core-auth");
//Configuración para usar variables de entorno
const dotenv = require('dotenv');
dotenv.config();

//Configuración de credenciales y endpoint para poder usar el servicio
//El endpoint solo se pasa al client
const endpoint = process.env.COMPUTER_VISION_ENDPOINT || "endpoint_computer_vision";
const apiKey = process.env.COMPUTER_VISION_API_KEY || "computer_vision_key";

console.log("Llegamos hasta aquí");
//Creamos el cliente con las credenciales y el endpoint configurado
const client = createClient(endpoint, new AzureKeyCredential(apiKey));

//Función para obtener el texto de la imagen del ticket usando la URL con tocken temporal para extraerla de blobStorage
const textoAImagen = async (imagenSAS) => {
    //Mostramos un mensaje indicando inicio del procesamiento
    console.log("Comenzando el análisis de la imagen")
    console.log("ENDPOINT:", endpoint);
    console.log("Estamos llegando hasta aquí en computer vision");
    //Hacemos la petición post al servicio computer vision esperando la respuesta del análisis
    const response = await client.path("/imageanalysis:analyze").post({
        body: {
            url: imagenSAS
        },
        queryParameters: {
            features: ["Read"],
            "language": "es"
        },
        contentType: "application/json"
    });

    //Extraemos el cuerpo de la respuesta
    const analysisResult = response.body;

    //Verifica que la respuesta este en un estado valido, de no ser así indicamos el error
    if (response.status != 200) {
        console.log("Muchos errores");
        console.log(response);
        return {value: false, content: "No se encontró texto en la imagen"};
    }

    console.log("El estatus esta correcto");

    const textoExtraido = extraerTextoDeAzure(analysisResult);
    console.log("TEXTO EXTRAIDO:");
    console.log(textoExtraido);
    if (!textoExtraido.trim()) {
        return { value: false, content: "No se encontró texto en la imagen", textoExtraido: "" };
    }

    return {
        value: true,
        content: analysisResult,
        textoExtraido
    };
}

const extraerTextoDeAzure = (analysisResult) => {
    if (!analysisResult?.readResult?.blocks) {
        return "";
    }

    return analysisResult.readResult.blocks
        .flatMap(block => block.lines)
        .map(line => line.text)
        .join('\n');
};

//Exportamos la función que tiene la lógica para conectar con computer vision
module.exports = {
    textoAImagen
}