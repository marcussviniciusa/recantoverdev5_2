import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  _id: string;
  // Configurações de comissão
  waiterCommissionEnabled: boolean;
  waiterCommissionPercentage: number;
  
  // Outras configurações futuras
  restaurantName?: string;
  currency?: string;
  timezone?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>({
  // Configurações de comissão dos garçons
  waiterCommissionEnabled: {
    type: Boolean,
    default: false,
    required: true
  },
  waiterCommissionPercentage: {
    type: Number,
    default: 10,
    min: [0, 'Percentual não pode ser negativo'],
    max: [50, 'Percentual não pode ser maior que 50%'],
    required: true
  },
  
  // Configurações gerais do restaurante
  restaurantName: {
    type: String,
    trim: true,
    maxlength: [100, 'Nome do restaurante não pode ter mais de 100 caracteres']
  },
  currency: {
    type: String,
    default: 'BRL',
    enum: ['BRL', 'USD', 'EUR'],
    required: true
  },
  timezone: {
    type: String,
    default: 'America/Sao_Paulo'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Garantir que só existe um documento de configurações
SettingsSchema.index({}, { unique: true });

// Método estático para obter configurações (criando se não existir)
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  
  if (!settings) {
    settings = await this.create({
      waiterCommissionEnabled: false,
      waiterCommissionPercentage: 10,
      restaurantName: 'Recanto Verde',
      currency: 'BRL',
      timezone: 'America/Sao_Paulo'
    });
  }
  
  return settings;
};

// Método para calcular comissão
SettingsSchema.methods.calculateCommission = function(amount: number): number {
  if (!this.waiterCommissionEnabled) {
    return 0;
  }
  
  return Math.round((amount * this.waiterCommissionPercentage / 100) * 100) / 100;
};

const Settings = mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings; 