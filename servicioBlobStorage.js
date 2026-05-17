const {
    BlobServiceClient,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions,
    expiryDate
} = require('@azure/storage-blob');
const startsOn = new Date();
startsOn.setMinutes(startsOn.getMinutes() - 5);
//Configuración para usar variables de entorno
const dotenv = require('dotenv');
dotenv.config();

//Configuración de credenciales
const accountName = process.env.ACCOUNT_NAME || "proyecto3storage";
const accountKey = process.env.ACCOUNT_KEY || "proyecto3storagekey";
const containerName = process.env.CONTAINER_NAME || "proyecto3container";

//Generamos nuestro permisos para poder acceder al blobStorage
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
//Creamos el cliente con las credenciales y el endpoint de acceso al blobStorage
const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential
);

//Función que nos va permitir guardar dentro de blob storage y generar el SAS para CV
const guardarTicket = async (blobName, ticketData) => {
    //Obtenemos el contenedor del cliente que es el equivalente a un bucket en S3
    const containerClient = blobServiceClient.getContainerClient(containerName);
    //Reservamos el espacio que va a equivaler al recurso que se va a guardar
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    //Subimos la imagen dentro del espacio reservado
    //Mostramos un mensaje que nos indique que la subida del recurso se esta llevando a cabo
    console.log("Subiendo recurso");
    await blockBlobClient.uploadData(ticketData);

    //Generamos el SAS(URL temporal) para ser usada por computer vision
    //Obtenemos la fecha actual y le sumamos 10 minutos para que el SAS pueda expirar despues de ese tiempo establecido 
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + 10);

    //Generación del token temporal
    const sasToken = generateBlobSASQueryParameters({
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        startsOn: startsOn,
        expiresOn: expiresOn
    }, sharedKeyCredential).toString();

    //Construir la URL completa con el sasToken
    //El block del recurso donde se guardo tiene una propiedad url donde se muestra la url entera hasta llegar a dicho recurso 
    //? indica que termina la url y siguen adicionales como el token temporal 
    const urlTemporal = `${blockBlobClient.url}?${sasToken}`;
    //Validamos que se haya generado el SAS de forma correcta para mandar el json apropiado como respuesta
    if(urlTemporal){
        return {value: true, content: urlTemporal};
    }else{
        return {value: false, content: "No se pudo generar el SAS temporal"};
    }
}

//Exportamos la función que tiene la lógica para conectar blobStorage
module.exports = {
    guardarTicket
}