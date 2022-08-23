import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SeadComponent } from './components/sead/sead.component';
import { TilescapeComponent } from './components/tilescape/tilescape.component';
import { VispComponent } from './components/visp/visp.component';
import { WestacComponent } from './components/westac/westac.component';
import { IonicModule } from '@ionic/angular';
import { EnidaComponent } from './components/enida/enida.component';
import { YrkesrumComponent } from './components/yrkesrum/yrkesrum.component';
import { StadenComponent } from './components/staden/staden.component';
import { DigitalamodellerComponent } from './components/digitalamodeller/digitalamodeller.component';
import { UtopiaComponent } from './components/utopia/utopia.component';
import { LinguisticLandscapeComponent } from './components/linguistic-landscape/linguistic-landscape.component';
import { InfravisSeadComponent } from './components/infravis-sead/infravis-sead.component';
import { InidunComponent } from './components/inidun/inidun.component';
import { DigitalPeriegesisComponent } from './components/digital-periegesis/digital-periegesis.component';

@NgModule({
  declarations: [
    AppComponent,
    SeadComponent,
    TilescapeComponent,
    VispComponent,
    WestacComponent,
    EnidaComponent,
    YrkesrumComponent,
    StadenComponent,
    DigitalamodellerComponent,
    UtopiaComponent,
    LinguisticLandscapeComponent,
    InfravisSeadComponent,
    InidunComponent,
    DigitalPeriegesisComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    IonicModule.forRoot()
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
