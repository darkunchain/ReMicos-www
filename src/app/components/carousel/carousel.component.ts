import { Component, OnInit } from '@angular/core';
import { SwiperOptions } from 'swiper';

@Component({
  selector: 'app-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.css']
})
export class CarouselComponent implements OnInit {

  images = [
    "assets/img/carousel_novena.svg",
    "assets/img/novena_marcas.jpeg",
    "assets/img/novena_17.jpeg",
    "assets/img/carousel_inicio.png",
    "assets/img/carousel_cumple.svg",

  ]


  config: SwiperOptions = {
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev'
    },
    spaceBetween: 30,
    speed: 1000,
    autoplay: {
      delay: 4000,
      disableOnInteraction: false,
    },
    loop: true
  }




  constructor() { }

  ngOnInit(): void {
  }

}
