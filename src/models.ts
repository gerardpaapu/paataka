export interface Organisation {
  id: number;
  name: string;
}

export interface OrganisationWithSecrets extends Organisation {
  key: Buffer;
  code: Buffer;
}

export interface Collection {
  id: number;
  name: string;
  group_name: string;
}
