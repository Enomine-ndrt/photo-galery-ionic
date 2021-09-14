import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, CameraPhoto } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem,Directory, FilesystemDirectory } from '@capacitor/filesystem';
import {Storage}from '@capacitor/storage';
import { Platform } from '@ionic/angular';
import { fileURLToPath } from 'url';
import {Photo} from '../models/photo.interface';
//import { Photo, PhotoService } from '../services/photo.service';
import { ActionSheetController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
 private photos: Photo[] = [];

 private PHOTO_STORAGE = 'photos';
 private platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
   }

  public async addNewToGallery(){
    const capturedPhoto = await Camera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    quality: 100
  });
 
  //Save the picture and add it to photo collection
  const savedImageFile = await this.savePicture(capturedPhoto);
  this.photos.unshift(savedImageFile);

  Storage.set({
    key: this.PHOTO_STORAGE,
    value: JSON.stringify(this.photos.map(p =>{
        const photoCopy = {... p};
        delete photoCopy.base64;
        return photoCopy;
    }))
  });
}

public async loadSaved(){
  //retrieve cached  photo array data
  const photos = await Storage.get({key: this.PHOTO_STORAGE});
  this.photos = JSON.parse(photos.value) || [];
  //Easiest way to detec when runnin on the web
  //"when the platform is not hybrid, do this"
  if(!this.platform.is('hybrid')){
    //display the photo by reading into base64 format
  for(let photo of this.photos){
    //read each saved photo's data from the Filesystem
    const readFile = await Filesystem.readFile({
      path: photo.filepath,
      directory: Directory.Data
    });
    //Web platform only: Load the photo as base64 data
    photo.webViewPath = `data:image/jpeg;base64,${readFile.data}`;
  }
}
}

 public  getPhotos(): Photo[]{
    return this.photos;
 }

 //save picture to file on device
 private async savePicture(cameraPhoto: CameraPhoto){
//Convert photo to base64 format, required by Filesystem API to save
   const base64Data = await this.readAsBase64(cameraPhoto);
   //Write the file to the data directory
   const fileName = new Date().getTime()+ '.jpeg';

  const savedFile = await Filesystem.writeFile({
      path: fileName,
      data:base64Data,
      directory: Directory.Data
   });

    if(this.platform.is('hybrid')){
      //Display the new image by rewriting the 'file://' path to HTTP
      //Details: https://ionicframework.com/docs/building/webview#file-protocol
      return {
        filepath: savedFile.uri,
        webViewPath: Capacitor.convertFileSrc(savedFile.uri)
      }
    }else{
      return {
        filepath: fileName,
        webViewPath: cameraPhoto.webPath
      }
    }
  }

  private async getPhotoFile(cameraPhoto:CameraPhoto, fileName:string):Promise<Photo>{
    return {
      filepath: fileName,
      webViewPath: cameraPhoto.webPath
    }
  }

 private async readAsBase64(cameraPhoto: CameraPhoto){
 // "hybrid" will detect Cordova or Capacitor
 if (this.platform.is('hybrid')) {
  // Read the file into base64 format
  const file = await Filesystem.readFile({
    path: cameraPhoto.path
  });

  return file.data;
}
else {
  // Fetch the photo, read as a blob, then convert to base64 format
  const response = await fetch(cameraPhoto.webPath);
  const blob = await response.blob();

  return await this.convertBlobToBase64(blob) as string;
}
}

convertBlobToBase64 = (blob: Blob) => new Promise((resolve,reject)=>{
  const reader = new FileReader;
  reader.onerror = reject;
  reader.onload = () =>{
      resolve(reader.result);
  };
  reader.readAsDataURL(blob);
});

public async deletePicture(photo: Photo,position: number){
  //Remove this photo from the Photos reference data array
  this.photos.splice(position,1);
  //Update photos array cache by overwriting the existing photo array
  Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
  });
  //delete photos from filesystem
  const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/')+1);
  await Filesystem.deleteFile({
    path: filename,
    directory: Directory.Data
  });

}

}