import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-gmaps',
  templateUrl: './gmaps.component.html',
  styleUrls: ['./gmaps.component.css']
})
export class GmapsComponent implements OnInit {

  title = 'My first AGM project';
  lat = 51.678418;
  lng = 7.809007;

  constructor() { }

  ngOnInit(): void {
  }

}
