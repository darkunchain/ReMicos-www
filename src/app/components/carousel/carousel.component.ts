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
    "assets/img/carousel1.png",
    "assets/img/carousel2.png",
    "assets/img/carousel3.png",
    "assets/img/carousel4.png"
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
    },
    loop: true
  }




  constructor() { }

  ngOnInit(): void {
  }

}
