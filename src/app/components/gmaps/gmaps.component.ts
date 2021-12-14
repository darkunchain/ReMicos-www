import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-gmaps',
  templateUrl: './gmaps.component.html',
  styleUrls: ['./gmaps.component.css']
})
export class GmapsComponent implements OnInit {

  title = 'My first AGM project';
  lat = 5.71781;
  lng = -72.92700;

  constructor() { }

  ngOnInit(): void {
  }

}
