import { AlertController } from '@ionic/angular';

export async function confirmMealConsumption(alertController: AlertController): Promise<boolean> {
  const alert = await alertController.create({
    header: '¿Marcar como consumida?',
    message: 'Se registrará una porción en tu progreso de hoy.',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Sí, marcar', role: 'confirm' },
    ],
  });
  await alert.present();
  return (await alert.onDidDismiss()).role === 'confirm';
}
