export interface IAnimalCommandConfig {
  apiURL: string;
  animalType: string;
  animalTitle: string;
  apiSource: string;
  errorMessage: string;
}

export interface IAnimalImageResponse {
  id: string;
  url: string;
  width?: number;
  height?: number;
}
