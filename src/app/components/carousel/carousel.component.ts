import { Component, OnInit, HostListener } from '@angular/core';
import { SwiperOptions } from 'swiper';

@Component({
  selector: 'app-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.css']
})
export class CarouselComponent implements OnInit {

  public mobile: boolean = false;

  public getScreenWidth: any;
  public getScreenHeight: any;

  images = [
    "assets/img/carousel_novena.svg",
    "assets/img/novena_marcas.jpeg",
    "assets/img/novena_17.jpeg",
    "assets/img/carousel_inicio.png",
    "assets/img/carousel_cumple.svg",

  ]

  imagesp = [
    "assets/img/carousel_novena_p.svg",
    "assets/img/carousel_cumple_p.svg",
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

  ngOnInit(){
      this.getScreenWidth = window.innerWidth;
      this.getScreenHeight = window.innerHeight;
  }

  @HostListener('window:resize', ['$event'])

  onWindowResize() {
    console.log('this.mobile:', this.mobile)
    this.getScreenWidth = window.innerWidth;
    this.getScreenHeight = window.innerHeight;
    console.log('size:',[this.getScreenWidth, this.getScreenHeight])
    if (this.getScreenWidth <= 600) { // 768px portrait
      this.mobile = true;
    }
    else{
      this.mobile = false;
    }
  }

}
