import { Component, OnInit } from '@angular/core';
import { BodyZone, EatWellService, Exercise } from '../core';

@Component({
  selector: 'app-actividad-espalda',
  templateUrl: './actividad-espalda.page.html',
  styleUrls: ['./actividad-espalda.page.scss'],
  standalone: false
})
export class ActividadEspaldaPage implements OnInit {
  selectedZone = 'Select a body zone';
  exercises: Exercise[] = [];
  hasSelectedZone = false;

  constructor(private readonly eatWellService: EatWellService) { }

  ngOnInit() {
  }

  async selectZone(zone: BodyZone, label: string): Promise<void> {
    this.selectedZone = label;
    this.hasSelectedZone = true;

    try {
      this.exercises = await this.eatWellService.getExercisesByBodyZone(zone);
    } catch {
      this.exercises = [];
    }
  }
}
