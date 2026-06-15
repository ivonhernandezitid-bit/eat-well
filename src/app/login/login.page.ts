import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false // <-- ASEGÚRATE DE QUE DIGA FALSE AQUÍ
})
export class LoginPage implements OnInit {
  constructor() { }
  ngOnInit() { }
}