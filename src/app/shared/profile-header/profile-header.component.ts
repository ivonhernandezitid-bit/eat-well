import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-profile-header',
  standalone: true,
  imports: [IonicModule, RouterLink],
  templateUrl: './profile-header.component.html',
  styleUrls: ['./profile-header.component.scss'],
})
export class ProfileHeaderComponent {
  @Input() title = '';
  @Input() backHref: string | null = null;
  @Input() backLabel = 'Volver a Perfil';
  @Input() saveLabel = 'Guardar';
  @Input() saveDisabled = false;

  @Output() readonly backClick = new EventEmitter<void>();
  @Output() readonly saveClick = new EventEmitter<void>();
}